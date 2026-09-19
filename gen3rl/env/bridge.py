from __future__ import annotations
import json, os, queue, subprocess, threading, time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

class ShowdownBridge:
    def __init__(self, worker=None, timeout=15):
        worker = Path(worker or ROOT / "showdown_bridge/dist/worker.js")
        env = os.environ.copy(); env["POKEMON_SHOWDOWN_ROOT"] = str(ROOT / "third_party/pokemon-showdown")
        self.proc = subprocess.Popen(["node", str(worker)], stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                     stderr=subprocess.PIPE, text=True, bufsize=1, env=env)
        self.events=queue.Queue(); self.timeout=timeout
        self.reader=threading.Thread(target=self._read, daemon=True); self.reader.start()
    def _read(self):
        assert self.proc.stdout
        for line in self.proc.stdout:
            try: self.events.put(json.loads(line))
            except json.JSONDecodeError: self.events.put({"type":"error","error":"invalid worker JSON","raw":line})
    def send(self, msg):
        if self.proc.poll() is not None:
            err=self.proc.stderr.read() if self.proc.stderr else ""; raise RuntimeError(f"bridge exited: {err}")
        assert self.proc.stdin; self.proc.stdin.write(json.dumps(msg,separators=(",",":"))+"\n"); self.proc.stdin.flush()
    def receive(self, predicate=lambda _: True, timeout=None):
        end=time.monotonic()+(timeout or self.timeout); skipped=[]
        while time.monotonic()<end:
            event=self.events.get(timeout=max(.01,end-time.monotonic()))
            if event.get("type")=="error": raise RuntimeError(event.get("error"))
            if predicate(event):
                for item in skipped: self.events.put(item)
                return event
            skipped.append(event)
        raise TimeoutError("Showdown bridge response timeout")
    def close(self):
        if self.proc.poll() is None:
            self.proc.terminate()
            try: self.proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.proc.kill(); self.proc.wait(timeout=5)
    def __enter__(self): return self
    def __exit__(self,*_): self.close()

DEFAULT_TEAM = [
    {"name":"Zangoose","species":"Zangoose","level":50,"ability":"Immunity","moves":["Return","Brick Break","Shadow Ball","Quick Attack"],"nature":"Adamant"},
    {"name":"Swampert","species":"Swampert","level":50,"ability":"Torrent","moves":["Surf","Earthquake","Ice Beam","Protect"],"nature":"Relaxed"},
]
