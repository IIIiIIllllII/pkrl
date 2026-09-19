import pytest
from gen3rl.features.schema import hp_bucket, gen3_damage_class, DamageClass, MoveRole
from gen3rl.features.encoder import classify_role, encode_request

@pytest.mark.parametrize("hp,maxhp,want",[(0,100,0),(1,100,1),(25,100,1),(26,100,2),(50,100,2),(51,100,3),(75,100,3),(76,100,4),(100,100,4)])
def test_hp_boundaries(hp,maxhp,want): assert hp_bucket(hp,maxhp)==want

def test_gen3_type_split():
    assert gen3_damage_class("Ghost",80)==DamageClass.PHYSICAL
    assert gen3_damage_class("Dark",80)==DamageClass.SPECIAL
    assert gen3_damage_class("Fire",0)==DamageClass.STATUS

def test_damaging_secondary_status_is_damage_role():
    assert classify_role({"id":"flamethrower","basePower":95,"secondary":{"status":"brn"}})==MoveRole.DAMAGE

def test_forced_switch_masks_every_move():
    request={"forceSwitch":[True],"active":None,"side":{"pokemon":[{"active":True,"condition":"0 fnt"},{"active":False,"condition":"10/10"}]}}
    _,mask=encode_request(request); assert mask.tolist()==[False,False,False,False,True,False,False,False,False]

def test_public_target_buckets_are_encoded_without_exact_hp():
    request={"active":[{"moves":[{"id":"surf","type":"Water","basePower":95,"accuracy":100,"priority":0,"pp":10,"effectivenessBucket":4}]}],
      "side":{"pokemon":[{"active":True,"condition":"20/100 brn","types":["Water"],"stats":{"spe":80}}]},
      "public":{"target":{"hpBucket":2,"status":"par","estimatedSpeed":90},"weather":"RainDance","turn":3}}
    features,_=encode_request(request); assert features[0,[8,10,11,12,13,14,18]].tolist()==[4,1,2,1,2,0,2]
