#include "encoder.h"
#include "semantics.generated.h"
#include <string.h>

static int bucket(int n, int a, int b, int c) {
    return n <= 0 ? 0 : n <= a ? 1 : n <= b ? 2 : n <= c ? 3 : 4;
}
static int chart(int attack, const int32_t types[2]) {
    int exponent=0, i;
    if (attack < 0 || attack >= 17) return 3;
    for(i=0;i<2;i++) {
        int d=types[i], factor;
        if(d<0 || d>=17 || (i && d==types[0])) continue;
        factor=rl_chart[attack][d];
        if(factor==9) return 0;
        exponent+=factor;
    }
    return exponent<=-2?1:exponent==-1?2:exponent==0?3:exponent==1?4:5;
}
void RlEncodePublic(const RlPublicObservation *o, uint8_t f[9][20], uint8_t mask[9]) {
    int i;
    memset(f,0,9*20); memset(mask,0,9);
    for(i=0;i<4;i++) {
        int id=o->moves[i], t=o->types[i], eff, flags, cls;
        const int16_t *m;
        if(id<=0 || id>354) continue;
        m=rl_moves[id]; cls=m[0]; flags=m[2]; eff=chart(t,o->target_types);
        if(flags & 1) eff=3; /* typeless Gen 3 damage */
        if((flags & 2) && o->target_status!=4) eff=0;
        if(cls==1) eff=eff==0?0:3;
        if(cls==2) {
            int bad=0;
            if(flags & 4) bad=eff==0;
            if(flags & 8) bad|=o->target_types[0]==7 || o->target_types[1]==7 || o->target_types[0]==16 || o->target_types[1]==16;
            if(flags & 16) bad|=o->target_types[0]==1 || o->target_types[1]==1;
            if(flags & 32) bad|=o->target_types[0]==4 || o->target_types[1]==4;
            if(flags & 64) bad|=o->target_status!=0;
            if(flags & 2) bad|=o->target_status!=4;
            eff=bad?0:3;
        }
        f[i][0]=i; f[i][1]=m[1]; f[i][2]=t;
        f[i][3]=cls==2?2:rl_physical[t]?0:1;
        f[i][4]=bucket(o->powers[i],40,70,100);
        f[i][5]=o->accuracy[i]<0?0:o->accuracy[i]<=70?1:o->accuracy[i]<=85?2:o->accuracy[i]<100?3:4;
        f[i][6]=o->priority[i]<0?0:o->priority[i]>0?2:1;
        f[i][7]=t==o->own_types[0] || t==o->own_types[1]; f[i][8]=eff;
        f[i][9]=bucket(o->pp[i],4,9,19);
        f[i][10]=o->hp<=0 || o->max_hp<=0?0:o->hp*4<=o->max_hp?1:o->hp*2<=o->max_hp?2:o->hp*4<=o->max_hp*3?3:4;
        f[i][11]=o->target_hp_bucket; f[i][12]=o->own_status; f[i][13]=o->target_status;
        f[i][14]=o->own_speed<o->estimated_target_speed?0:o->own_speed>o->estimated_target_speed?2:1;
        f[i][17]=o->turn<=1; f[i][18]=o->weather; f[i][19]=2;
        mask[i]=!o->forced_switch && !o->disabled[i] && o->pp[i]!=0;
    }
    if(o->forced_switch || !o->trapped)
        for(i=0;i<o->switch_count && i<5;i++) mask[4+i]=1;
    if(o->wait) memset(mask,0,9);
}
