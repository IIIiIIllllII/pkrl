import pytest
from gen3rl.features.schema import hp_bucket, gen3_damage_class, DamageClass, Effectiveness, MoveRole, SCHEMA_VERSION, parameter_count
from gen3rl.features.encoder import classify_role, encode_request
from gen3rl.features.move_semantics import MoveClass, classify_move, damage_effectiveness, effectiveness_feature, status_applicable

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
      "public":{"target":{"hpBucket":2,"status":"par","types":["Fire"],"estimatedSpeed":90},"weather":"RainDance","turn":3}}
    features,_=encode_request(request); assert features[0,[8,10,11,12,13,14,18]].tolist()==[4,1,2,1,2,0,2]

def test_v1_1_keeps_layout_but_changes_semantics():
    assert SCHEMA_VERSION == "gen3-lut-v1.1"
    assert parameter_count() == 349

@pytest.mark.parametrize("move_type,target_types,want",[
    ("Ground", ["Steel", "Flying"], Effectiveness.IMMUNE),
    ("Electric", ["Water", "Ground"], Effectiveness.IMMUNE),
    ("Ice", ["Dragon", "Flying"], Effectiveness.QUADRUPLE),
    ("Fire", ["Bug", "Steel"], Effectiveness.QUADRUPLE),
    ("Fighting", ["Ghost", "Poison"], Effectiveness.IMMUNE),
    ("Psychic", ["Rock", "Dark"], Effectiveness.IMMUNE),
    ("Poison", ["Steel", "Psychic"], Effectiveness.IMMUNE),
    ("Dark", ["Steel"], Effectiveness.HALF),
    ("Ghost", ["Steel"], Effectiveness.HALF),
])
def test_gen3_dual_type_damage_effectiveness(move_type,target_types,want):
    assert damage_effectiveness(move_type,target_types) == want

@pytest.mark.parametrize("move",[
    {"id":"dragondance","type":"Dragon","basePower":0,"self":{"boosts":{"atk":1,"spe":1}}},
    {"id":"swordsdance","type":"Normal","basePower":0,"self":{"boosts":{"atk":2}}},
    {"id":"recover","type":"Normal","basePower":0},
    {"id":"protect","type":"Normal","basePower":0},
    {"id":"growl","type":"Normal","basePower":0,"boosts":{"atk":-1}},
    {"id":"confuseray","type":"Ghost","basePower":0},
])
def test_status_and_self_moves_do_not_use_generic_type_chart(move):
    assert classify_move(move) == MoveClass.STATUS
    assert effectiveness_feature(move,["Ghost", "Steel"]) == Effectiveness.NEUTRAL

@pytest.mark.parametrize("move,target_types",[
    ({"id":"thunderwave","type":"Electric","status":"par"}, ["Ground"]),
    ({"id":"toxic","type":"Poison","status":"tox"}, ["Steel"]),
    ({"id":"toxic","type":"Poison","status":"tox"}, ["Poison"]),
    ({"id":"willowisp","type":"Fire","status":"brn"}, ["Fire"]),
    ({"id":"leechseed","type":"Grass"}, ["Grass"]),
])
def test_mechanics_specific_status_failure(move,target_types):
    assert not status_applicable(move,target_types)
    assert effectiveness_feature(move,target_types) == Effectiveness.IMMUNE

@pytest.mark.parametrize("move,target_types,want",[
    ({"id":"seismictoss","type":"Fighting"}, ["Ghost"], Effectiveness.IMMUNE),
    ({"id":"seismictoss","type":"Fighting"}, ["Water"], Effectiveness.NEUTRAL),
    ({"id":"nightshade","type":"Ghost"}, ["Normal"], Effectiveness.IMMUNE),
    ({"id":"nightshade","type":"Ghost"}, ["Steel"], Effectiveness.NEUTRAL),
])
def test_fixed_damage_uses_immunity_but_not_resistance(move,target_types,want):
    assert classify_move(move) == MoveClass.FIXED_DAMAGE
    assert effectiveness_feature(move,target_types) == want

def test_encoder_recomputes_semantics_instead_of_trusting_bridge_bucket():
    request={"active":[{"moves":[
      {"id":"earthquake","move":"Earthquake","type":"Ground","basePower":100,"pp":10,"effectivenessBucket":5},
      {"id":"dragondance","move":"Dragon Dance","type":"Dragon","basePower":0,"pp":10,"effectivenessBucket":5,"self":{"boosts":{"atk":1}}},
    ]}],"side":{"pokemon":[{"active":True,"condition":"100/100","types":["Water"],"stats":{"spe":80}}]},
      "public":{"target":{"hpBucket":4,"status":"","types":["Steel","Flying"],"estimatedSpeed":70},"turn":2}}
    features,_=encode_request(request)
    assert features[:2,8].tolist() == [Effectiveness.IMMUNE,Effectiveness.NEUTRAL]
