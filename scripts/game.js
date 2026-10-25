(() => {
    const root=document.getElementById('aquadome-futebol-preview');if(!root)return;
    const el=id=>root.querySelector('#'+id);
    const layer=el('aq-action'),backLayer=el('aq-effects-back'),frontLayer=el('aq-effects-front'),message=el('aq-message');
    const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
    const angle=a=>Math.atan2(Math.sin(a),Math.cos(a));
    const cross=(ax,ay,bx,by)=>ax*by-ay*bx;
    const n=v=>Number(v.toFixed(2));
    const G=540,L=100,R=1500,H=790,FLOOR=860,BR=25,CAR_SCALE=.8,GB=310,GT=520,RAMP=110,MID=(L+R)/2;
    const BOOST_FORCE=1200,BOOST_DRAIN=24;
    const hull=[[-28,-21],[28,-21],[38,-6],[14,20],[-10,20],[-37,4],[-36,-8]];
    const walls=[
      {ax:L,ay:0,bx:R,by:0,nx:0,ny:1},
      {ax:L,ay:H,bx:R,by:H,nx:0,ny:-1},
      {ax:L,ay:0,bx:L,by:GB,nx:1,ny:0},
      {ax:L,ay:GT,bx:L,by:H,nx:1,ny:0},
      {ax:R,ay:0,bx:R,by:GB,nx:-1,ny:0},
      {ax:R,ay:GT,bx:R,by:H,nx:-1,ny:0},
      {ax:22,ay:GB,bx:L,by:GB,nx:0,ny:1},
      {ax:22,ay:GT,bx:L,by:GT,nx:0,ny:-1},
      {ax:22,ay:GB,bx:22,by:GT,nx:1,ny:0},
      {ax:R,ay:GB,bx:1578,by:GB,nx:0,ny:1},
      {ax:R,ay:GT,bx:1578,by:GT,nx:0,ny:-1},
      {ax:1578,ay:GB,bx:1578,by:GT,nx:-1,ny:0}
    ];
    for(const side of [-1,1]){
      const cx=side<0?L+RAMP:R-RAMP;
      for(let i=0;i<10;i++){
        const a=-Math.PI/2+side*i*Math.PI/20,b=-Math.PI/2+side*(i+1)*Math.PI/20;
        const ax=cx+RAMP*Math.cos(a),ay=RAMP+RAMP*Math.sin(a),bx=cx+RAMP*Math.cos(b),by=RAMP+RAMP*Math.sin(b),mid=(a+b)/2;
        walls.push({ax,ay,bx,by,nx:-Math.cos(mid),ny:-Math.sin(mid)});
      }
    }
    const reduced=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
    function makeSimulation(initialSeed){
      let seed=initialSeed>>>0,solverTick=0,predictionAt=-1,predictionCache=[];
      const random=()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;};
      const range=(a,b)=>a+(b-a)*random();
      const s={seed:initialSeed,time:0,remaining:120,round:1,scores:[0,0],phase:'kickoff',pause:1.1,overtime:false,history:[],cars:[],ball:null,particles:[],trails:[],goalX:0,goalTeam:0,goalAge:10,lastTouch:-1,lastHit:0,trapTime:0,trapCooldown:0,stats:{goals:0,touches:0,aerials:0,jumps:0,doubleJumps:0,flips:0,flicks:0,flipResets:0,resetAttempts:0,pinches:0,breakouts:0,maxTrap:0,defensiveFlips:0,reboundPlans:0,boostSeconds:0,boostEquivalent:0,fuelSpent:0,recharged:0,groundSeconds:0,airSeconds:0,wallBounces:0,carrySeconds:0,longestCarry:0,airDribbles:0},messageKey:''};
      function makeCar(team){
        return{team,face:team===0?1:-1,x:L+(R-L)*(team===0?range(.22,.25):range(.75,.78)),y:22*CAR_SCALE,vx:0,vy:0,a:0,w:0,im:1/8.5,ii:1/(8.5*1800*CAR_SCALE*CAR_SCALE),fuel:100,boosting:false,boostPower:0,grounded:true,groundNX:0,groundNY:1,sinceGround:0,groundTime:0,airTime:0,jumpReady:true,jumpCooldown:0,dodgeReady:false,dodgeTime:0,dodgeX:0,dodgeY:0,flipTime:0,flipSign:0,flipKind:'',aiWait:range(0,.025),think:range(.021,.029),aggression:range(.97,1.03),patience:range(.12,.27),stuck:0,touchWait:0,lastBallContact:-10,lastWheelBall:-10,resetArmed:true,lastReset:-10,resetGlow:0,resetUntil:0,lastResetAttempt:-10,breakUntil:0,breakRole:0,carryRun:0,carryStart:0,carryCounted:false,mode:'setup',cmd:{throttle:0,boost:false,boostPower:0,jump:false,doubleJump:false,flip:false,targetAngle:0}};
      }
      function kickoff(){
        s.cars=[makeCar(0),makeCar(1)];
        s.ball={x:MID,y:BR+.05,vx:range(-8,8),vy:0,a:0,w:0,r:BR,im:1,ii:1/(.5*BR*BR)};
        s.trails=[];s.lastTouch=-1;s.lastHit=s.time;s.phase='kickoff';s.pause=1.1;s.trapTime=0;s.trapCooldown=0;predictionAt=-1;
      }
      function emit(x,y,color,count,power){
        if(reduced||power<100)return;count=Math.min(count,6);
        for(let i=0;i<count;i++){const a=range(0,Math.PI*2),v=range(power*.25,power);s.particles.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,age:0,life:range(.22,.55),r:range(1.2,3),color});}
      }
      function vertices(c){
        const co=Math.cos(c.a),si=Math.sin(c.a);
        let list=hull.map(([x,y])=>{x*=c.face*CAR_SCALE;y*=CAR_SCALE;return{x:c.x+x*co-y*si,y:c.y+x*si+y*co};});
        if(c.face<0)list.reverse();return list;
      }
      function impulse(b,ix,iy,rx,ry){
        b.vx+=ix*b.im;b.vy+=iy*b.im;b.w+=cross(rx,ry,ix,iy)*b.ii;
      }
      function resolvePair(a,b,nx,ny,px,py,penetration,restitution,friction){
        const ia=a.im,ib=b.im,sum=ia+ib,fix=Math.max(0,penetration-.015)*.86/sum;
        a.x-=nx*fix*ia;a.y-=ny*fix*ia;b.x+=nx*fix*ib;b.y+=ny*fix*ib;
        const ax=px-a.x,ay=py-a.y,bx=px-b.x,by=py-b.y;
        let rvx=(b.vx-b.w*by)-(a.vx-a.w*ay),rvy=(b.vy+b.w*bx)-(a.vy+a.w*ax);
        const vn=rvx*nx+rvy*ny;
        if(vn>=0)return 0;
        const an=cross(ax,ay,nx,ny),bn=cross(bx,by,nx,ny);
        const j=-(1+restitution)*vn/(sum+an*an*a.ii+bn*bn*b.ii);
        impulse(a,-nx*j,-ny*j,ax,ay);impulse(b,nx*j,ny*j,bx,by);
        rvx=(b.vx-b.w*by)-(a.vx-a.w*ay);rvy=(b.vy+b.w*bx)-(a.vy+a.w*ax);
        const tx=-ny,ty=nx,at=cross(ax,ay,tx,ty),bt=cross(bx,by,tx,ty);
        const jt=clamp(-(rvx*tx+rvy*ty)/(sum+at*at*a.ii+bt*bt*b.ii),-friction*j,friction*j);
        impulse(a,-tx*jt,-ty*jt,ax,ay);impulse(b,tx*jt,ty*jt,bx,by);
        return j;
      }
      function ballCar(c,b,record=true){
        if(Math.abs(c.x-b.x)>65||Math.abs(c.y-b.y)>65)return;
        const poly=vertices(c);let inside=true,nearest=Infinity,point=null,norm=null,maxSigned=-Infinity,insideNormal=null;
        for(let i=0;i<poly.length;i++){
          const p=poly[i],q=poly[(i+1)%poly.length],ex=q.x-p.x,ey=q.y-p.y,len=Math.hypot(ex,ey),nx=ey/len,ny=-ex/len;
          const signed=(b.x-p.x)*nx+(b.y-p.y)*ny;if(signed>0)inside=false;
          if(signed>maxSigned){maxSigned=signed;insideNormal={x:nx,y:ny};}
          const t=clamp(((b.x-p.x)*ex+(b.y-p.y)*ey)/(len*len),0,1),cx=p.x+t*ex,cy=p.y+t*ey,d=Math.hypot(b.x-cx,b.y-cy);
          if(d<nearest){nearest=d;point={x:cx,y:cy};norm={x:(b.x-cx)/(d||1),y:(b.y-cy)/(d||1)};}
        }
        if(!inside&&nearest>=b.r)return;
        if(inside){norm=insideNormal;point={x:b.x-norm.x*maxSigned,y:b.y-norm.y*maxSigned};nearest=maxSigned;}
        const closing=(c.vx-b.vx)*norm.x+(c.vy-b.vy)*norm.y;
        const restitution=c.dodgeTime>0?.94:closing<65?.12:closing<240?.32:.82;
        const j=resolvePair(c,b,norm.x,norm.y,point.x,point.y,b.r-nearest,restitution,.09);
        if(record){
          c.lastBallContact=s.time;
          const co=Math.cos(c.a),si=Math.sin(c.a),localX=(b.x-c.x)*co+(b.y-c.y)*si;
          const wheelContact=norm.x*si-norm.y*co>.82&&Math.abs(localX)<27*CAR_SCALE;
          if(wheelContact){
            if(c.resetArmed&&!c.dodgeReady&&c.sinceGround>.09&&c.airTime>.12&&s.time-c.lastReset>.28){
              c.dodgeReady=true;c.resetGlow=.24;c.lastReset=s.time;c.resetUntil=0;s.stats.flipResets++;
            }
            c.lastWheelBall=s.time;c.resetArmed=false;
          }
          if(j>45&&closing>140&&s.time-(b.wallTime??-10)<.025&&norm.x*b.wallNX+norm.y*b.wallNY<-.55&&s.time-(c.lastPinch??-10)>.35){s.stats.pinches++;c.lastPinch=s.time;}
          if(j>35)predictionAt=-1;
        }
        if(record&&j>4&&c.touchWait<=0){
          c.touchWait=.14;s.lastTouch=c.team;s.lastHit=s.time;s.stats.touches++;if(c.y>65)s.stats.aerials++;
          emit(point.x,point.y,c.team===0?'#8bd8ff':'#ffd18c',7,90);
        }
      }
      function ballWorld(b,record=true){
        for(const w of walls){
          const ex=w.bx-w.ax,ey=w.by-w.ay,t=clamp(((b.x-w.ax)*ex+(b.y-w.ay)*ey)/(ex*ex+ey*ey),0,1);
          const px=w.ax+t*ex,py=w.ay+t*ey,dx=b.x-px,dy=b.y-py,d=Math.hypot(dx,dy);
          if(d>=b.r+2)continue;
          let nx=d>.001?dx/d:w.nx,ny=d>.001?dy/d:w.ny;
          const penetration=b.r+2-d;b.x+=nx*penetration;b.y+=ny*penetration;
          if(record){b.wallTime=s.time;b.wallNX=nx;b.wallNY=ny;}
          const vn=b.vx*nx+b.vy*ny;
          if(vn<0){
            const e=Math.abs(vn)<24?0:.76;
            b.vx-=(1+e)*vn*nx;b.vy-=(1+e)*vn*ny;
            const tx=-ny,ty=nx,vt=b.vx*tx+b.vy*ty-b.w*b.r,jt=clamp(-vt/(b.im+b.r*b.r*b.ii),-Math.abs(vn)*.035,Math.abs(vn)*.035);
            b.vx+=tx*jt*b.im;b.vy+=ty*jt*b.im;b.w-=jt*b.r*b.ii;
            if(record&&Math.abs(vn)>60)s.stats.wallBounces++;
          }
        }
      }
      function carWorld(c){
        for(const w of walls){
          if(c.x<Math.min(w.ax,w.bx)-50||c.x>Math.max(w.ax,w.bx)+50||c.y<Math.min(w.ay,w.by)-50||c.y>Math.max(w.ay,w.by)+50)continue;
          const ex=w.bx-w.ax,ey=w.by-w.ay,len2=ex*ex+ey*ey,poly=vertices(c);
          const contacts=[];
          for(const p of poly){
            const t=((p.x-w.ax)*ex+(p.y-w.ay)*ey)/len2;
            const dist=(p.x-w.ax)*w.nx+(p.y-w.ay)*w.ny;
            if(t>=-.004&&t<=1.004&&dist<.08&&dist>-70)contacts.push({p,dist});
          }
          if(!contacts.length)continue;
          const depth=Math.max(...contacts.map(v=>-v.dist));
          if(depth>0){c.x+=w.nx*(depth+.005);c.y+=w.ny*(depth+.005);}
          const wheelsFacing=-Math.sin(c.a)*w.nx+Math.cos(c.a)*w.ny;
          if(wheelsFacing>.45){c.grounded=true;c.sinceGround=0;c.groundNX=w.nx;c.groundNY=w.ny;}
          const contactPoints=contacts.length>1?[{p:{x:contacts.reduce((v,item)=>v+item.p.x,0)/contacts.length,y:contacts.reduce((v,item)=>v+item.p.y,0)/contacts.length}}]:contacts;
          for(const {p}of contactPoints){
            const rx=p.x-c.x,ry=p.y-c.y,vx=c.vx-c.w*ry,vy=c.vy+c.w*rx,vn=vx*w.nx+vy*w.ny;
            if(vn>=0)continue;
            const rn=cross(rx,ry,w.nx,w.ny),j=-vn*1.035/(c.im+rn*rn*c.ii);
            impulse(c,w.nx*j,w.ny*j,rx,ry);
            const tx=-w.ny,ty=w.nx,rt=cross(rx,ry,tx,ty);
            const vt=(c.vx-c.w*ry)*tx+(c.vy+c.w*rx)*ty;
            const friction=wheelsFacing>.45?.035:.35;
            const jt=clamp(-vt/(c.im+rt*rt*c.ii),-j*friction,j*friction);
            impulse(c,tx*jt,ty*jt,rx,ry);
          }
        }
      }
      function prediction(){
        if(predictionAt>=0&&s.time-predictionAt<.018)return predictionCache;
        const b={...s.ball},result=[];let bounced=false;
        for(let i=1;i<=80;i++){
          const dt=.025;b.vy-=G*dt;b.vx*=Math.exp(-.035*dt);b.x+=b.vx*dt;b.y+=b.vy*dt;
          const vx=b.vx,vy=b.vy;ballWorld(b,false);if(Math.abs(vx-b.vx)+Math.abs(vy-b.vy)>35)bounced=true;
          result.push({x:b.x,y:b.y,vx:b.vx,vy:b.vy,t:i*dt,bounced});
          if((b.x+b.r<L-2||b.x-b.r>R+2)&&b.y>GB&&b.y<GT)break;
        }
        predictionAt=s.time;predictionCache=result;return result;
      }
      // A planned contact is a car position, never an assigned ball velocity.
      function noseOffset(c,nx,ny){
        const a=Math.atan2(ny,nx)-(c.face<0?Math.PI:0),co=Math.cos(a),si=Math.sin(a);
        return{x:c.face*38*CAR_SCALE*co+6*CAR_SCALE*si+nx*(BR-.65),y:c.face*38*CAR_SCALE*si-6*CAR_SCALE*co+ny*(BR-.65)};
      }
      function flightCommand(c,cmd,ax,ay){
        const force=Math.hypot(ax,ay),target=angle(Math.atan2(ay,ax)-(c.face<0?Math.PI:0));
        cmd.targetAngle=target;
        const alignment=Math.max(0,Math.cos(angle(target-c.a)));
        // Average rapid boost taps for small corrections instead of full-throttle oscillation.
        cmd.boostPower=c.fuel>.05?clamp(force/BOOST_FORCE,0,1)*Math.pow(alignment,4):0;
        cmd.boost=cmd.boostPower>.015;
      }
      function carryPlan(c,b){
        const dir=c.face,distance=dir*((dir>0?R:L)-b.x),goalY=(GB+GT)/2;
        const opponent=s.cars[1-c.team],ahead=opponent?dir*(opponent.x-b.x):Infinity;
        let routeY=goalY+clamp(distance/600,0,1)*48;
        if(ahead>20&&ahead<220){
          const opponentY=clamp(opponent.y+opponent.vy*.16-.5*G*.16*.16,20,H-35);
          const weight=Math.sin((ahead-20)/200*Math.PI);
          routeY=Math.min(H-150,routeY+Math.max(0,opponentY+125-routeY)*weight);
        }
        const wantedVX=dir*clamp(190+distance*.16,215,310),wantedVY=clamp((routeY-b.y)*1.3,-135,165);
        const ax=clamp((wantedVX-b.vx)*1.65,-340,340),ay=G+clamp((wantedVY-b.vy)*1.9,-360,360);
        const length=Math.hypot(ax,ay),nx=ax/length,ny=ay/length,offset=noseOffset(c,nx,ny);
        return{ax,ay,nx,ny,x:b.x-offset.x,y:b.y-offset.y,distance,goalY};
      }
      function interception(c,pred,onGround){
        let best=null,bestCost=Infinity;
        for(const p of pred){
          if(p.t<.225||p.t>1.6||p.y<87||p.y>H-40)continue;
          const plan=carryPlan(c,p),tx=clamp(plan.x,L+34,R-34),ty=clamp(plan.y,35,H-55),t=p.t;
          const vy=c.vy+(onGround?355:0);
          const ax=6*(tx-c.x)/(t*t)-(4*c.vx+2*p.vx)/t;
          const ay=6*(ty-c.y)/(t*t)-(4*vy+2*p.vy)/t+G;
          const force=Math.hypot(ax,ay),target=angle(Math.atan2(ay,ax)-(c.face<0?Math.PI:0));
          const cost=Math.max(0,force-1050)*1.5+t*160+Math.abs(angle(target-c.a))*45+Math.abs(tx-c.x)*.025;
          if(cost<bestCost){bestCost=cost;best={...p,tx,ty,ax,ay,force};}
        }
        return best;
      }
      function shotVector(c,b,opponent,clear=false){
        const dir=c.face,distance=dir*((dir>0?R:L)-b.x);
        const covered=opponent&&dir*((dir>0?R:L)-opponent.x)<340;
        const targetY=clamp((GB+GT)/2+(covered?(opponent.y<(GB+GT)/2?58:-58):0),GB+BR+16,GT-BR-16);
        const vx=dir*(clear?570:620),t=clamp(distance/Math.abs(vx),.12,1.8);
        const vy=clamp((targetY-b.y+.5*G*t*t)/t,-280,570);
        return{x:vx-b.vx,y:vy-b.vy,targetY};
      }
      function chooseFlip(c,cmd,x,y,kind){
        cmd.flip=true;cmd.doubleJump=false;cmd.flick=kind==='flick';cmd.flipKind=kind;
        c.dodgeX=x;c.dodgeY=y;cmd.boost=false;cmd.boostPower=0;c.mode=kind;
      }
      function tactics(c,cmd,b,opponent,onGround,danger,intercept){
        const dx=b.x-c.x,dy=b.y-c.y,distance=Math.hypot(dx,dy),dir=c.face;
        const relativeSpeed=Math.hypot(b.vx-c.vx,b.vy-c.vy),opponentDistance=Math.hypot(b.x-opponent.x,b.y-opponent.y);
        if(c.flipTime>0){cmd.boost=false;cmd.boostPower=0;cmd.flip=false;cmd.doubleJump=false;return;}
        if(c.breakUntil>s.time){
          c.mode=c.breakRole===1?'release':'reposition';cmd.flip=false;cmd.doubleJump=false;
          if(c.breakRole===1){
            if(onGround){cmd.jump=c.jumpReady&&c.jumpCooldown<=0;cmd.throttle=dir*.55;}
            else if(c.dodgeReady&&distance<100)chooseFlip(c,cmd,dir*130,230,'release');
            else flightCommand(c,cmd,dir*380,850);
          }else if(onGround){cmd.jump=false;cmd.throttle=clamp((-dir*235-c.vx)/90,-1,1);cmd.boost=false;cmd.boostPower=0;}
          else flightCommand(c,cmd,-dir*650,200);
          return;
        }
        if(c.resetUntil>s.time&&!c.dodgeReady&&!onGround){
          const nx=dx+(b.vx-c.vx)*.08,ny=dy+(b.vy-c.vy)*.08;
          c.mode='reset';cmd.targetAngle=angle(Math.atan2(ny,nx)+Math.PI/2);cmd.boost=false;cmd.boostPower=0;cmd.flip=false;cmd.doubleJump=false;return;
        }
        if(c.flickUntil>s.time&&!onGround&&c.dodgeReady&&c.airTime>.065&&distance<86&&dy>24){
          const shot=shotVector(c,b,opponent,danger);chooseFlip(c,cmd,shot.x,shot.y,'flick');c.flickUntil=0;return;
        }
        if(!onGround&&!c.dodgeReady&&c.resetArmed&&c.y>115&&b.y>155&&dy>12&&distance<78&&relativeSpeed<165&&!danger&&s.time-c.lastResetAttempt>1.45){
          const closing=((c.vx-b.vx)*dx+(c.vy-b.vy)*dy)/(distance||1);
          if(closing> -22&&closing<120){
            c.resetUntil=s.time+.38;c.lastResetAttempt=s.time;s.stats.resetAttempts++;
            c.mode='reset';cmd.targetAngle=angle(Math.atan2(dy,dx)+Math.PI/2);cmd.boost=false;cmd.boostPower=0;cmd.doubleJump=false;return;
          }
        }
        if(!onGround&&c.dodgeReady&&c.airTime>.14&&distance<105){
          const co=Math.cos(c.a),si=Math.sin(c.a),localX=dir*(dx*co+dy*si),localY=-dx*si+dy*co;
          const roof=localY>10&&localY<63&&localX> -12&&localX<33&&distance<72;
          const goalDistance=dir*((dir>0?R:L)-b.x),pressure=opponentDistance<110&&dir*(opponent.x-b.x)> -30;
          const pinchFloor=b.y<BR+24&&c.y>b.y+32&&dir*dx> -10;
          const pinchCeiling=H-b.y<BR+24&&dy>24&&dir*dx> -10;
          const pinchWall=(b.x<L+BR+20||b.x>R-BR-20)&&Math.abs(dx)>24&&Math.abs(dy)>12;
          if((pinchFloor||pinchCeiling||(pinchWall&&(pressure||danger)))&&distance<88&&Math.hypot(c.vx,c.vy)>130){chooseFlip(c,cmd,dx,dy,'pinch');return;}
          const settled=c.carryRun>.22||(s.time-c.lastBallContact<.10&&relativeSpeed<110);
          if(c.mode==='carry'&&!settled&&!danger&&goalDistance>140)return;
          if(c.mode==='carry'&&(!settled||c.carryRun<.40)&&!danger&&opponentDistance>65&&goalDistance>180)return;
          if(roof&&settled&&(pressure||goalDistance<420)&&c.y>45){
            if(pressure&&goalDistance>180){
              if(!c.flickHoldUntil)c.flickHoldUntil=s.time+c.patience;
              if(s.time<c.flickHoldUntil&&opponentDistance>65)return;
            }
            const shot=shotVector(c,b,opponent,danger);chooseFlip(c,cmd,shot.x,shot.y,'flick');return;
          }
          if(!pressure)c.flickHoldUntil=0;
          const shot=shotVector(c,b,opponent,danger),length=Math.hypot(shot.x,shot.y)||1;
          const aligned=(dx*shot.x+dy*shot.y)/((distance||1)*length);
          const closing=((c.vx-b.vx)*dx+(c.vy-b.vy)*dy)/(distance||1);
          const inShootingHeight=b.y>GB+25&&b.y<GT-15;
          const useful=danger||(pressure&&relativeSpeed<240)||(goalDistance<380&&inShootingHeight);
          if(useful&&aligned>.80&&dir*shot.x>20&&dy> -75&&distance<86){chooseFlip(c,cmd,shot.x,shot.y,danger?'clear':'shoot');return;}
          if(danger&&distance<82&&dir*dx> -12){chooseFlip(c,cmd,dir*400,Math.max(100,dy),'clear');return;}
        }
        if(intercept?.bounced&&c.mode==='intercept'&&s.time-(c.lastReboundPlan??-10)>1){s.stats.reboundPlans++;c.lastReboundPlan=s.time;}
        if(!onGround&&c.mode!=='carry'&&c.mode!=='reset'){
          const landing=(c.vy+Math.sqrt(c.vy*c.vy+2*G*Math.max(c.y-18,0)))/G;
          if((landing<.26&&c.x>L+RAMP&&c.x<R-RAMP)||(c.fuel<10&&distance>180)){
            c.mode='recover';cmd.targetAngle=0;cmd.boost=false;cmd.boostPower=0;cmd.doubleJump=false;
          }
        }
      }
      function think(c){
        const b=s.ball,dir=c.face,pred=prediction(),onGround=c.sinceGround<.055;
        const dx=b.x-c.x,dy=b.y-c.y,distance=Math.hypot(dx,dy),relativeSpeed=Math.hypot(b.vx-c.vx,b.vy-c.vy);
        const ownX=dir>0?L:R,opponent=s.cars[1-c.team];
        const danger=pred.some(p=>dir*(p.x-ownX)<115&&p.y>GB-BR&&p.y<GT+BR)&&dir*b.vx<0;
        const cmd={throttle:0,boost:false,boostPower:0,jump:false,doubleJump:false,flip:false,targetAngle:0};
        c.mode=danger?'defend':'intercept';
        const intercept=interception(c,pred,onGround);
        if(onGround){
          let aim=intercept||pred[12]||b;
          const behind=dir*dx>-8,low=b.y<92;
          let tx;
          if(low){
            const lead=clamp(Math.abs(dx)/480,.06,.45);
            tx=b.x+b.vx*lead-dir*(behind?12:105);
          }else tx=aim.x-dir*42;
          if(danger){const p=pred.find(p=>p.t>.28&&dir*(p.x-ownX)>50)||aim;tx=p.x-dir*32;}
          tx=clamp(tx,L+35,R-35);
          const desired=clamp((tx-c.x)*4.8+(low?b.vx*.6:aim.vx*.35),-360,360)*c.aggression;
          cmd.throttle=clamp((desired-c.vx)/85,-1,1);
          const launch=intercept&&intercept.force<1390&&Math.abs(intercept.tx-c.x)<410&&b.y>90&&dy>65;
          if(c.jumpReady&&c.jumpCooldown<=0&&launch&&(c.fuel>20||intercept.ty<150))cmd.jump=true;
          const hoodControl=b.y>52&&dy>31&&Math.abs(dx)<58&&s.time-c.lastBallContact<.16;
          if(c.jumpReady&&c.jumpCooldown<=0&&hoodControl&&c.fuel>24){
            cmd.jump=true;c.mode='launch';
            const challenge=Math.hypot(b.x-opponent.x,b.y-opponent.y);
            if(challenge<180&&challenge>65&&dir*dx> -5&&dir*dx<32&&s.time-opponent.lastBallContact>.16)c.flickUntil=s.time+.40;
          }
          if(c.stuck>.42&&c.jumpReady&&c.jumpCooldown<=0)cmd.jump=true;
          const forwardGap=dir*(tx-c.x),forwardSpeed=dir*c.vx;
          if(forwardGap>150&&forwardSpeed>70&&Math.abs(c.a)<.18&&behind){
            cmd.boostPower=clamp((forwardGap-100)/220,0,.8);cmd.boost=c.fuel>12;
          }
          if(Math.abs(c.groundNX)>.65){
            const upward=b.y>c.y-20&&Math.abs(dx)<320;
            cmd.throttle=upward?-Math.sign(c.groundNX):Math.sign(c.groundNX);
            cmd.jump=c.jumpReady&&c.jumpCooldown<=0&&b.y>100&&distance<290&&c.fuel>20;
            cmd.boost=false;cmd.boostPower=0;
          }
          if(cmd.jump){cmd.boost=false;cmd.boostPower=0;}
        }else{
          const recent=s.time-c.lastBallContact<.32;
          const canCarry=c.y>62&&b.y>105&&dy>12&&dy<130&&distance<(recent?165:155)&&relativeSpeed<(recent?390:340)&&c.fuel>3;
          if(canCarry){
            c.mode='carry';const plan=carryPlan(c,b),massFactor=1+c.im;
            const ax=clamp(plan.ax*massFactor+(plan.x-c.x)*18+(b.vx-c.vx)*6,-480,480);
            const ay=clamp(plan.ay*massFactor+(plan.y-c.y)*18+(b.vy-c.vy)*6,260,1100);
            flightCommand(c,cmd,ax,ay);
          }else if(intercept&&c.fuel>1){
            flightCommand(c,cmd,intercept.ax,Math.max(130,intercept.ay));
            if(c.dodgeReady&&c.airTime>.20&&intercept.ty>c.y+110&&c.vy<60&&Math.abs(intercept.tx-c.x)<170&&intercept.ay>1150)cmd.doubleJump=true;
          }else{
            c.mode='recover';
            const tx=clamp(b.x-dir*110,L+140,R-140),ax=clamp((tx-c.x)*2-c.vx*2,-650,650);
            if(c.fuel>3&&c.y>125)flightCommand(c,cmd,ax,G*.3);
          }
          if(c.y>H-65&&c.vy>0){cmd.boost=false;cmd.boostPower=0;cmd.targetAngle=0;}
          if(c.x>L+8&&c.x<R-8&&c.y<58*CAR_SCALE&&c.vy<85){cmd.targetAngle=0;cmd.boost=false;cmd.boostPower=0;cmd.flip=false;cmd.doubleJump=false;c.mode='recover';}
        }
        tactics(c,cmd,b,opponent,onGround,danger,intercept);
        c.cmd=cmd;c.aiWait=c.think;
      }
      function moveCar(c,dt){
        c.aiWait-=dt;c.jumpCooldown=Math.max(0,c.jumpCooldown-dt);c.touchWait=Math.max(0,c.touchWait-dt);c.resetGlow=Math.max(0,c.resetGlow-dt);
        if(s.time-c.lastWheelBall>.09)c.resetArmed=true;
        if(c.aiWait<=0)think(c);
        const cmd=c.cmd,onGround=c.sinceGround<.055;
        if(onGround){c.groundTime+=dt;c.airTime=0;s.stats.groundSeconds+=dt;if(c.groundTime>.06)c.jumpReady=true;}
        else{c.groundTime=0;c.airTime+=dt;s.stats.airSeconds+=dt;}
        c.stuck=onGround&&Math.abs(cmd.throttle)>.65&&Math.abs(c.vx)<35?c.stuck+dt:Math.max(0,c.stuck-dt*2);
        if(cmd.jump&&c.jumpReady&&onGround&&c.jumpCooldown<=0){
          c.vx+=c.groundNX*355;c.vy+=c.groundNY*355;c.x+=c.groundNX*.5;c.y+=c.groundNY*.5;c.grounded=false;c.sinceGround=.1;c.jumpReady=false;c.dodgeReady=true;c.jumpCooldown=.42;s.stats.jumps++;
        }
        cmd.jump=false;
        if(cmd.doubleJump&&c.dodgeReady&&!onGround){c.vy+=255;c.dodgeReady=false;s.stats.doubleJumps++;}
        cmd.doubleJump=false;
        if(cmd.flip&&c.dodgeReady&&!onGround){
          const length=Math.hypot(c.dodgeX,c.dodgeY)||1,nx=c.dodgeX/length,ny=c.dodgeY/length;
          c.vx+=nx*190;c.vy+=ny*190;c.flipTime=.31;c.flipSign=cmd.flick?c.face:-(Math.sign(nx)||c.face);c.w=c.flipSign*19.5;c.dodgeTime=.31;c.dodgeReady=false;c.flipKind=cmd.flipKind||'shoot';s.stats.flips++;
          if(cmd.flick)s.stats.flicks++;if(c.flipKind==='clear')s.stats.defensiveFlips++;
        }
        cmd.flip=false;c.dodgeTime=Math.max(0,c.dodgeTime-dt);
        if(onGround){
          let drive=cmd.throttle*870;
          if(Math.abs(c.vx)>315&&drive*c.vx>0)drive*=.10;
          if(cmd.throttle*c.vx<0)drive*=1.2;
          c.vx+=(drive*c.groundNY-c.vx*.55)*dt;c.vy-=drive*c.groundNX*dt;
        }
        const target=onGround?Math.atan2(-c.groundNX,c.groundNY):cmd.targetAngle;
        if(c.flipTime>0){c.w+=clamp((c.flipSign*20.2-c.w)*32,-650,650)*dt;c.flipTime=Math.max(0,c.flipTime-dt);if(c.flipTime===0)c.w*=.12;}
        else c.w+=clamp(angle(target-c.a)*240-c.w*29,-240,240)*dt;
        const power=cmd.boost&&c.fuel>0&&c.flipTime<=0?clamp(cmd.boostPower===undefined?1:cmd.boostPower,0,1):0;
        c.boostPower=power;c.boosting=power>.015;
        if(c.boosting){
          c.vx+=c.face*Math.cos(c.a)*BOOST_FORCE*power*dt;c.vy+=c.face*Math.sin(c.a)*BOOST_FORCE*power*dt;
          const spent=Math.min(c.fuel,BOOST_DRAIN*power*dt);c.fuel-=spent;s.stats.fuelSpent+=spent;s.stats.boostSeconds+=dt;s.stats.boostEquivalent+=power*dt;
        }else if(onGround){const charge=Math.min(100-c.fuel,85*dt);c.fuel+=charge;s.stats.recharged+=charge;}
        c.vy-=G*dt;c.vx*=Math.exp(-.13*dt);c.w*=Math.exp(-.45*dt);
        const speed=Math.hypot(c.vx,c.vy);if(speed>650){c.vx*=650/speed;c.vy*=650/speed;}
        c.w=clamp(c.w,c.flipTime>0?-23:-9,c.flipTime>0?23:9);c.x+=c.vx*dt;c.y+=c.vy*dt;c.a=angle(c.a+c.w*dt);
        c.grounded=false;c.sinceGround+=dt;
      }
      function resolveTrap(dt){
        const b=s.ball;
        const held=s.cars.every(c=>s.time-c.lastBallContact<.065&&Math.hypot(b.x-c.x,b.y-c.y)<88&&Math.hypot(b.vx-c.vx,b.vy-c.vy)<105);
        s.trapTime=held?s.trapTime+dt:0;s.stats.maxTrap=Math.max(s.stats.maxTrap,s.trapTime);
        s.trapCooldown=Math.max(0,s.trapCooldown-dt);
        if(s.trapTime>.50&&s.trapCooldown===0){
          const score=c=>c.face*(b.x-c.x)+(b.y-c.y)*.15+c.fuel*.03;
          const delta=score(s.cars[0])-score(s.cars[1]);
          const leader=Math.abs(delta)<2?(random()<.5?0:1):delta>0?0:1;
          for(const c of s.cars){c.breakUntil=s.time+.72;c.breakRole=c.team===leader?1:-1;c.aiWait=0;}
          s.stats.breakouts++;s.trapCooldown=1.0;
        }
      }
      function goal(team){
        s.scores[team]++;s.stats.goals++;s.phase='goal';s.pause=1.85;s.goalTeam=team;s.goalX=team===0?R+28:L-28;s.goalAge=0;
        emit(s.ball.x,s.ball.y,team===0?'#68c7ff':'#ffbc6b',32,230);
      }
      function finish(){
        s.phase='finished';s.pause=2.8;s.history.push({round:s.round,blue:s.scores[0],orange:s.scores[1],winner:s.scores[0]===s.scores[1]?-1:s.scores[0]>s.scores[1]?0:1});if(s.history.length>12)s.history.shift();
      }
      function physics(dt){
        const first=solverTick++&1;
        for(const c of s.cars)moveCar(c,dt);
        const b=s.ball;b.vy-=G*dt;b.vx*=Math.exp(-.035*dt);b.w*=Math.exp(-.12*dt);b.x+=b.vx*dt;b.y+=b.vy*dt;b.a+=b.w*dt;
        for(let k=0;k<4;k++){
          for(const c of s.cars)carWorld(c);
          ballWorld(b);
          ballCar(s.cars[(k+first)&1],b);ballCar(s.cars[1-((k+first)&1)],b);
        }
        for(const c of s.cars)carWorld(c);ballWorld(b);
        const speed=Math.hypot(b.vx,b.vy);if(speed>1050){b.vx*=1050/speed;b.vy*=1050/speed;}
        resolveTrap(dt);
        for(const c of s.cars){
          const controlled=c.y>75&&b.y>110&&s.time-c.lastBallContact<.13&&Math.hypot(b.x-c.x,b.y-c.y)<85&&Math.hypot(b.vx-c.vx,b.vy-c.vy)<125;
          if(controlled){
            if(c.carryRun===0)c.carryStart=b.x;
            c.carryRun+=dt;s.stats.carrySeconds+=dt;s.stats.longestCarry=Math.max(s.stats.longestCarry,c.carryRun);
            if(!c.carryCounted&&c.carryRun>.45&&c.face*(b.x-c.carryStart)>55){s.stats.airDribbles++;c.carryCounted=true;}
          }else{c.carryRun=0;c.carryCounted=false;}
        }
        if((b.x-b.r>R+3||b.x+b.r<L-3)&&b.y>GB&&b.y<GT)goal(b.x>MID?0:1);
      }
      function step(dt){
        s.time+=dt;s.goalAge+=dt;
        s.particles=s.particles.filter(p=>{p.age+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy-=240*dt;return p.age<p.life;});
        if(s.phase!=='play'){
          s.pause-=dt;
          for(const c of s.cars){c.boosting=false;c.boostPower=0;c.resetGlow=Math.max(0,c.resetGlow-dt);}
          if(s.pause<=0){
            if(s.phase==='finished'){s.round++;s.scores=[0,0];s.remaining=120;s.overtime=false;kickoff();}
            else if(s.phase==='goal'){if(s.overtime)finish();else kickoff();}
            else{s.phase='play';}
          }
          return;
        }
        s.remaining-=dt;
        if(s.remaining<=0&&!s.overtime){if(s.scores[0]===s.scores[1]){s.overtime=true;s.remaining=30;}else{finish();return;}}
        else if(s.remaining<=0&&s.overtime){finish();return;}
        physics(dt);
        if(Math.floor(s.time*40)!==Math.floor((s.time-dt)*40)){s.trails.push({x:s.ball.x,y:s.ball.y});if(s.trails.length>4)s.trails.shift();}
      }
      kickoff();
      return{state:s,step,physics,ballCar,ballWorld,carWorld,resolvePair,prediction,think,vertices,carryPlan,noseOffset,moveCar,chooseFlip,tactics,resolveTrap};
    }
    let initialSeed=Math.floor(Math.random()*4294967296);
    if(typeof crypto!=='undefined'&&crypto.getRandomValues){const values=new Uint32Array(1);crypto.getRandomValues(values);initialSeed=values[0];}
    const game=makeSimulation(initialSeed),s=game.state;
    function draw(){
      const b=s.ball;
      let html='<ellipse cx="'+n(b.x)+'" cy="'+FLOOR+'" rx="'+n(12+b.y*.025)+'" ry="3.5" fill="#020d18" opacity="'+n(clamp(.3-b.y*.0004,.1,.3))+'"/>';
      let behind='',front='';
      if(!reduced)s.trails.forEach((p,i)=>{behind+='<circle cx="'+n(p.x)+'" cy="'+n(FLOOR-p.y)+'" r="'+n(2+i*1.3)+'" fill="#d6edfa" opacity="'+n(i*.035)+'"/>';});
      for(const c of s.cars){
        const x=n(c.x),y=n(FLOOR-c.y),col=c.team===0?'#43b4f4':'#ffac4f';
        html+='<ellipse cx="'+x+'" cy="'+FLOOR+'" rx="'+n(34*CAR_SCALE)+'" ry="'+n(4*CAR_SCALE)+'" fill="#010c18" opacity="'+n(clamp(.3-c.y*.00055,.08,.3))+'"/>';
        html+='<g transform="translate('+x+' '+y+') rotate('+n(-c.a*180/Math.PI)+') scale('+n(c.face*CAR_SCALE)+' '+CAR_SCALE+')" color="'+col+'">';
        if(c.boosting){const len=clamp(28+Math.hypot(c.vx,c.vy)*.045,28,57)*Math.sqrt(c.boostPower||1);
          html+='<path d="M-37-3Q-'+n(44+len*.3)+'-13 -'+n(43+len)+' 2Q-'+n(45+len*.3)+' 16 -37 8Z" fill="#ffab4c" opacity=".85"/><path d="M-37-1Q-60-5 -'+n(47+len*.5)+' 2Q-58 9 -37 6Z" fill="#fff2ba"/>';
        }
        html+='<use href="#aq-car-body" xlink:href="#aq-car-body"/>';
        if(c.resetGlow>0)html+='<path d="M-26 19H26" fill="none" stroke="#f5fff9" stroke-width="4" stroke-linecap="round" opacity="'+n(c.resetGlow/.24)+'"/>';
        const spin=n(c.x*2.6*c.face);
        for(const xx of [-23,23])html+='<path d="M'+(xx-5)+' 11H'+(xx+5)+'M'+xx+' 6V16" stroke="#dcebf4" stroke-width="1.4" opacity=".65" transform="rotate('+spin+' '+xx+' 11)"/>';
        html+='</g>';
      }
      html+='<g transform="translate('+n(b.x)+' '+n(FLOOR-b.y)+') rotate('+n(-b.a*180/Math.PI)+')"><circle r="25" fill="url(#aq-ball-shade)" stroke="#243b44" stroke-width="1.4"/><g stroke="#526b70" stroke-width=".8" stroke-linejoin="round"><path d="M-7-11L-13-20L-4-24L10-22L7-11Z" fill="#d9e0d3"/><path d="M13 0L24-4L24 9L16 20L7 11Z" fill="#a1b5ad"/><path d="M-13 0L-24-8L-24 8L-16 19L-7 11Z" fill="#8fa7a3"/><path d="M-7 11L-8 23L7 24L16 20L7 11Z" fill="#bdcbbc"/><path d="M-7-11H7L13 0L7 11H-7L-13 0Z" fill="#384e55"/></g><circle r="5" fill="#172e36" stroke="#829c9c" stroke-width="1.4"/><circle r="2.1" fill="#b9e7df"/><path d="M-15-14Q-10-21-4-22" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="2" stroke-linecap="round"/></g>';
      for(const p of s.particles)front+='<circle cx="'+n(p.x)+'" cy="'+n(FLOOR-p.y)+'" r="'+n(p.r*(1-p.age/p.life))+'" fill="'+p.color+'" opacity="'+n(1-p.age/p.life)+'"/>';
      layer.innerHTML=html;backLayer.innerHTML=behind;frontLayer.innerHTML=front;
      el('aq-score-blue').textContent=s.scores[0];el('aq-score-orange').textContent=s.scores[1];
      const secs=Math.max(0,Math.ceil(s.remaining));el('aq-time').textContent=String(Math.floor(secs/60)).padStart(2,'0')+':'+String(secs%60).padStart(2,'0');
      el('aq-round').textContent=s.overtime?'PRORROGAÇÃO':'PARTIDA '+String(s.round).padStart(2,'0');
      const key=s.phase+(s.phase==='goal'?s.goalTeam:'')+(s.phase==='finished'?s.scores.join('-'):'');
      if(key!==s.messageKey){
        s.messageKey=key;message.hidden=s.phase==='play';
        if(s.phase==='kickoff')message.innerHTML='SAÍDA DE BOLA<small>Prontos para acelerar</small>';
        if(s.phase==='goal')message.innerHTML='GOL '+(s.goalTeam===0?'AZUL':'LARANJA')+'!<small>+1 no placar</small>';
        if(s.phase==='finished')message.innerHTML=(s.scores[0]===s.scores[1]?'EMPATE':s.scores[0]>s.scores[1]?'AZUL VENCEU':'LARANJA VENCEU')+'<small>Nova partida em instantes</small>';
      }
    }
    let last=null,accumulator=0,paint=0;
    function tick(now){
      if(last===null)last=now;
      accumulator+=Math.min(.075,(now-last)/1000);last=now;
      while(accumulator>=1/240){game.step(1/240);accumulator-=1/240;}
      if(now-paint>1000/(reduced?30:60)){draw();paint=now;}
      requestAnimationFrame(tick);
    }
    draw();
    window.__aquadomeSoccerPreview={makeSimulation,game,draw,walls,hull,constants:{G,L,R,H,FLOOR,BR,CAR_SCALE,GB,GT,RAMP,MID,BOOST_FORCE,BOOST_DRAIN}};
    requestAnimationFrame(tick);
  })();
