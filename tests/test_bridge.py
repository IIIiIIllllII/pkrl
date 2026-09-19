import json
from gen3rl.env.bridge import ShowdownBridge, DEFAULT_TEAM
from gen3rl.policy.lut import AdditiveLUTPolicy
from gen3rl.runner import battle

def test_ping():
    with ShowdownBridge() as b:
        b.send({"cmd":"ping"}); assert b.receive()["type"]=="pong"

def test_no_hidden_opponent_party_leak():
    enemy=[{"species":"Pidgey","level":50,"ability":"Keen Eye","moves":["Tackle"]},
           {"species":"Mewtwo","level":50,"ability":"Pressure","moves":["Psychic"]}]
    with ShowdownBridge() as b:
        b.send({"cmd":"reset","battle_id":"privacy","format":"gen3customgame","seed":[1,2,3,4],"p1_team":DEFAULT_TEAM,"p2_team":enemy})
        event=b.receive(lambda e:e.get("type")=="request" and e.get("player")=="p1")
        text=json.dumps(event["request"]).lower()
        assert "pidgey" in text  # the active species is legitimately public
        assert "mewtwo" not in text and "pressure" not in text
        assert "condition" not in event["request"]["public"]["target"]  # opponent HP is bucketed before IPC

def test_same_seed_is_deterministic():
    policy=AdditiveLUTPolicy()
    a=battle(policy,seed=4401,deterministic=True)
    b=battle(policy,seed=4401,deterministic=True)
    assert (a[1],a[2])==(b[1],b[2])
    assert [x[2] for x in a[0]]==[x[2] for x in b[0]]
