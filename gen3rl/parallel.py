"""Synchronous process-parallel rollout collection.

Each Python child owns exactly one persistent Node BattleStream bridge.  The
learner freezes and broadcasts one tiny LUT policy per generation, then waits
for every in-flight battle before PPO.  There is intentionally no asynchronous
policy optimization here.
"""
from __future__ import annotations

import hashlib
import multiprocessing as mp
from multiprocessing.connection import wait
import os
import random
import signal
import time
import traceback
from pathlib import Path

import numpy as np
import torch

from gen3rl.env.bridge import ShowdownBridge
from gen3rl.policy.lut import AdditiveLUTPolicy, NumpyLUTActor
from gen3rl.runner import battle
from gen3rl.teams import cartridge_match, synthetic_match


def derive_worker_seed(master_seed: int, worker_id: int) -> int:
    raw=f"gen3rl-worker-v1:{int(master_seed)}:{int(worker_id)}".encode()
    return int.from_bytes(hashlib.sha256(raw).digest()[:8], "big") & 0x7FFFFFFF


def derive_battle_seed(master_seed: int, battle_index: int) -> int:
    raw=f"gen3rl-battle-v1:{int(master_seed)}:{int(battle_index)}".encode()
    return int.from_bytes(hashlib.sha256(raw).digest()[:8], "big") & 0x7FFFFFFF


def initial_seed_schedule(master_seed: int, workers: int):
    return [{"worker_id":i,"worker_seed":derive_worker_seed(master_seed,i),
             "battle_seed":derive_battle_seed(master_seed,i)} for i in range(workers)]


def validate_policy_versions(results, expected_version: int):
    versions={int(result["policy_version"]) for result in results}
    if versions!={int(expected_version)}:
        raise RuntimeError(f"mixed policy versions in rollout generation: expected {expected_version}, got {sorted(versions)}")


def policy_payload(policy: AdditiveLUTPolicy):
    return {name:t.detach().cpu().numpy().copy() for name,t in policy.state_dict().items()}


def _load_payload(payload):
    policy=AdditiveLUTPolicy()
    policy.load_state_dict({name:torch.as_tensor(value) for name,value in payload.items()})
    policy.eval()
    return policy


def _worker_main(worker_id, worker_seed, connection):
    random.seed(worker_seed); np.random.seed(worker_seed & 0xFFFFFFFF); torch.manual_seed(worker_seed)
    bridge=None; actor=None; policy=None; version=None; worker_started=time.perf_counter()
    try:
        bridge=ShowdownBridge()
        connection.send({"type":"ready","worker_id":worker_id,"worker_seed":worker_seed,
                         "pid":os.getpid(),"node_pid":bridge.proc.pid,"startup_seconds":time.perf_counter()-worker_started})
        while True:
            command=connection.recv(); kind=command["cmd"]
            if kind=="close": connection.send({"type":"closed","worker_id":worker_id}); break
            if kind=="sync":
                tick=time.perf_counter(); policy=_load_payload(command["policy"]); actor=NumpyLUTActor(policy); version=int(command["policy_version"])
                connection.send({"type":"synced","worker_id":worker_id,"policy_version":version,"sync_seconds":time.perf_counter()-tick}); continue
            if kind!="battle": raise ValueError(f"unknown rollout worker command {kind}")
            if actor is None or version!=int(command["policy_version"]):
                raise RuntimeError(f"worker {worker_id} has policy {version}, requested {command['policy_version']}")
            seed=int(command["battle_seed"]); random.seed(seed); np.random.seed(seed & 0xFFFFFFFF); torch.manual_seed(seed)
            opponent_policy=None
            if command.get("opponent_snapshot"):
                state=torch.load(command["opponent_snapshot"],map_location="cpu",weights_only=False)
                opponent_policy=AdditiveLUTPolicy(); opponent_policy.load_state_dict(state["policy"]); opponent_policy.eval()
            profile={}; tick=time.perf_counter()
            traces,reward,winner,elapsed=battle(policy,seed,False,bridge=bridge,teams=command["teams"],
                opponent=command["opponent"],opponent_policy=opponent_policy,profile=profile,actor=actor,
                battle_id=command["battle_id"])
            connection.send({"type":"trajectory","worker_id":worker_id,"worker_seed":worker_seed,
                "battle_index":command["battle_index"],"battle_seed":seed,"battle_id":command["battle_id"],
                "policy_version":version,"traces":traces,"reward":reward,"winner":winner,"elapsed":elapsed,
                "worker_wall_seconds":time.perf_counter()-tick,"profile":profile,"illegal_actions":profile.get("illegal_actions",0)})
    except (EOFError, KeyboardInterrupt):
        pass
    except BaseException as error:
        try: connection.send({"type":"worker_error","worker_id":worker_id,"error":repr(error),"traceback":traceback.format_exc()})
        except BaseException: pass
    finally:
        if bridge is not None: bridge.close()
        connection.close()


class RolloutPool:
    def __init__(self, workers: int, master_seed: int, timeout: float=60.0):
        if workers<1: raise ValueError("workers must be positive")
        self.workers=int(workers); self.master_seed=int(master_seed); self.timeout=float(timeout)
        # Linux is the deployment target. Fork keeps PyTorch's read-only pages
        # shared instead of importing a private copy in every rollout process.
        # Workers start Node only after the fork and never touch CUDA.
        method="fork" if os.name=="posix" else "spawn"
        self.context=mp.get_context(method); self.start_method=method
        self.connections=[]; self.processes=[]; self.ready=[]; self.restart_count=0
        self.synced_version=None
        start=time.perf_counter()
        for worker_id in range(self.workers):
            parent,child=self.context.Pipe(duplex=True); seed=derive_worker_seed(master_seed,worker_id)
            process=self.context.Process(target=_worker_main,args=(worker_id,seed,child),name=f"gen3rl-rollout-{worker_id}")
            process.start(); child.close(); self.connections.append(parent); self.processes.append(process)
        for connection in self.connections: self.ready.append(self._receive(connection,"ready"))
        self.startup_seconds=time.perf_counter()-start

    def _receive(self, connection, expected=None):
        if not connection.poll(self.timeout):
            self._check_processes(); raise TimeoutError(f"rollout worker timed out waiting for {expected or 'response'}")
        try: message=connection.recv()
        except EOFError as error:
            self._check_processes(); raise RuntimeError("rollout worker pipe closed") from error
        if message.get("type")=="worker_error": raise RuntimeError(f"worker {message['worker_id']} failed: {message['error']}\n{message.get('traceback','')}")
        if expected and message.get("type")!=expected: raise RuntimeError(f"expected {expected}, got {message.get('type')}")
        return message

    def _check_processes(self):
        failed=[(i,p.exitcode) for i,p in enumerate(self.processes) if not p.is_alive()]
        if failed: raise RuntimeError(f"rollout workers exited: {failed}")

    def sync(self, policy, policy_version):
        payload=policy_payload(policy); tick=time.perf_counter()
        for connection in self.connections: connection.send({"cmd":"sync","policy":payload,"policy_version":int(policy_version)})
        replies=[self._receive(connection,"synced") for connection in self.connections]
        if any(r["policy_version"]!=int(policy_version) for r in replies): raise RuntimeError("policy sync version mismatch")
        self.synced_version=int(policy_version)
        return time.perf_counter()-tick

    def _job(self, worker_id, battle_index, policy_version, domain_weights, opponent_weights, opponent_paths):
        seed=derive_battle_seed(self.master_seed,battle_index); rng=random.Random(seed)
        domains=list(domain_weights); domain=rng.choices(domains,weights=[float(domain_weights[x]) for x in domains],k=1)[0]
        teams=cartridge_match(seed,"train") if domain=="cartridge" else synthetic_match(seed)
        opponents=list(opponent_weights); opponent=rng.choices(opponents,weights=[float(opponent_weights[x]) for x in opponents],k=1)[0]
        snapshot=None
        if opponent=="historical" and opponent_paths: snapshot=opponent_paths[rng.randrange(len(opponent_paths))]
        else: opponent="random" if opponent=="random" else "damage"
        return {"cmd":"battle","worker_id":worker_id,"battle_index":battle_index,"battle_seed":seed,
            "battle_id":f"w{worker_id}-v{policy_version}-b{battle_index}","policy_version":int(policy_version),
            "domain":domain,"teams":teams,"opponent":opponent,"opponent_snapshot":snapshot}

    def collect(self, policy, policy_version, start_battle_index, domain_weights, opponent_weights, opponent_paths=(),
                target_decisions=None, max_battles=None, deadline_seconds=None):
        if target_decisions is None and max_battles is None and deadline_seconds is None: raise ValueError("collection needs a stopping condition")
        sync_seconds=self.sync(policy,policy_version) if self.synced_version!=int(policy_version) else 0.0
        start=time.perf_counter(); next_index=int(start_battle_index)
        inflight={}; results=[]; decisions=0; queue_wait=0.0
        def can_submit():
            if max_battles is not None and next_index-start_battle_index>=max_battles: return False
            if target_decisions is not None and decisions>=target_decisions: return False
            if deadline_seconds is not None and time.perf_counter()-start>=deadline_seconds: return False
            return True
        def submit(worker_id):
            nonlocal next_index
            job=self._job(worker_id,next_index,policy_version,domain_weights,opponent_weights,opponent_paths)
            self.connections[worker_id].send(job); inflight[self.connections[worker_id]]=worker_id; next_index+=1
        for worker_id in range(self.workers):
            if can_submit(): submit(worker_id)
        while inflight:
            tick=time.perf_counter(); ready=wait(list(inflight),timeout=self.timeout); queue_wait+=time.perf_counter()-tick
            if not ready: self._check_processes(); raise TimeoutError("rollout generation timed out")
            for connection in ready:
                worker_id=inflight.pop(connection); result=self._receive(connection,"trajectory")
                if result["battle_id"]!=f"w{worker_id}-v{policy_version}-b{result['battle_index']}": raise RuntimeError("cross-worker battle response mixup")
                results.append(result); decisions+=len(result["traces"])
                if can_submit(): submit(worker_id)
        ids=[r["battle_id"] for r in results]
        validate_policy_versions(results,policy_version)
        if len(ids)!=len(set(ids)): raise RuntimeError("duplicate battle trajectories returned")
        wall=time.perf_counter()-start; by_worker={}
        for result in results:
            row=by_worker.setdefault(str(result["worker_id"]),{"battles":0,"decisions":0,"worker_wall_seconds":0.0})
            row["battles"]+=1; row["decisions"]+=len(result["traces"]); row["worker_wall_seconds"]+=result["worker_wall_seconds"]
        for row in by_worker.values():
            row["battles_per_second"]=row["battles"]/max(row["worker_wall_seconds"],1e-9)
            row["decisions_per_second"]=row["decisions"]/max(row["worker_wall_seconds"],1e-9)
        return results,{"policy_version":int(policy_version),"policy_sync_seconds":sync_seconds,"rollout_wall_seconds":wall,
            "queue_wait_seconds":queue_wait,"battles":len(results),"decisions":decisions,"per_worker":by_worker,
            "worker_restarts":self.restart_count,"worker_startup_seconds":self.startup_seconds}

    def close(self):
        for connection,process in zip(self.connections,self.processes):
            if process.is_alive():
                try: connection.send({"cmd":"close"})
                except (BrokenPipeError,EOFError): pass
        for index,(connection,process) in enumerate(zip(self.connections,self.processes)):
            if process.is_alive():
                try: self._receive(connection,"closed")
                except Exception: pass
            process.join(timeout=5)
            if process.is_alive(): process.terminate(); process.join(timeout=5)
            # A worker killed outside its Python cleanup path can orphan Node.
            # The PID came directly from that worker's ready handshake.
            node_pid=self.ready[index].get("node_pid") if index<len(self.ready) else None
            if node_pid and Path(f"/proc/{node_pid}").exists():
                try: os.kill(node_pid,signal.SIGTERM)
                except ProcessLookupError: pass
            connection.close()

    def __enter__(self): return self
    def __exit__(self,*_): self.close()
