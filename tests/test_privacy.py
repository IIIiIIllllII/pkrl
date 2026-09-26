import copy
import json
import random
import numpy as np
import torch
from gen3rl.env.bridge import ShowdownBridge, DEFAULT_TEAM
from gen3rl.features.encoder import encode_request
from gen3rl.policy.lut import AdditiveLUTPolicy
from gen3rl.runner import evaluate_suites

def test_hidden_fields_cannot_change_python_features_or_masks():
    fixture=json.load(open("web-playtest/public/v1-1-parity-fixtures.json"))["fixtures"][0]
    request=fixture["request"]; expected=encode_request(request)
    changed=copy.deepcopy(request)
    secrets={"unrevealed_moves":["Psychic"],"bench":["Mewtwo"],"item":"Choice Band","ability":"Shadow Tag",
        "future_human_choice":"switch 2","simulator":{"rng":[1,2,3,4],"opponent_speed":999}}
    changed.update(secrets); changed["public"]["target"].update(secrets)
    actual=encode_request(changed)
    for a,b in zip(actual,expected): np.testing.assert_array_equal(a,b)

def test_bridge_counterfactual_hidden_team_is_observationally_identical():
    observations=[]
    for moves,item,ability,bench in ((["Tackle"],"Leftovers","Run Away","Mewtwo"),(["Protect"],"Choice Band","Guts","Mew")):
        enemy=[{"species":"Rattata","level":50,"moves":moves,"item":item,"ability":ability},
               {"species":bench,"level":50,"moves":["Psychic"]}]
        with ShowdownBridge() as bridge:
            bridge.send({"cmd":"reset","battle_id":"hidden","format":"gen3customgame","seed":[9,8,7,6],"p1_team":DEFAULT_TEAM,"p2_team":enemy})
            event=bridge.receive(lambda e:e.get("type")=="request" and e.get("player")=="p1")
            observations.append(event["request"])
    assert observations[0]==observations[1]
    assert set(observations[0]["public"]["target"])=={"species","hpBucket","status","types","estimatedSpeed"}

def test_evaluation_preserves_policy_and_all_training_rng_states():
    policy=AdditiveLUTPolicy(); weights=copy.deepcopy(policy.state_dict())
    py=random.getstate(); npstate=np.random.get_state(); tr=torch.get_rng_state().clone()
    with ShowdownBridge() as bridge: evaluate_suites(policy,bridge,games=1,seed=61)
    assert random.getstate()==py
    now=np.random.get_state(); assert now[0]==npstate[0] and now[2:]==npstate[2:]
    np.testing.assert_array_equal(now[1],npstate[1]); assert torch.equal(torch.get_rng_state(),tr)
    assert policy.training
    for name,value in weights.items(): assert torch.equal(value,policy.state_dict()[name])
