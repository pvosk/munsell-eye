import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3,Quaternion,Matrix4,PerspectiveCamera} from 'three';
import {PLAY_LEVELS,directedLabBank,generateDirectedHole,mixtureColor,colorDistance} from '../app/play-engine';
import {replayRoute,paletteSignature} from '../app/play-course-analysis';
import {auditTraits,timingSupported} from '../app/play-route-audit';
import {LAB_DIRECTED,newLabAttempt,validLabEvent,nextFixedLabSpecimen,labHoleProgress} from '../app/play-lab-model';
import {paletteReveal,revealPosition,planPaletteReveal,bridgeRevealRange} from '../app/play-palette-reveal';

test('directed round has eight fixed, private-sync-compatible, cyclic tests',()=>{
  assert.equal(directedLabBank.signature,paletteSignature(21));
  assert.equal(LAB_DIRECTED.length,8);
  assert.equal(new Set(LAB_DIRECTED.map(s=>s.hole.courseId)).size,8);
  for(const [i,s] of LAB_DIRECTED.entries()){
    assert.deepEqual(generateDirectedHole(s.levelIndex,s.hole.stage),s.hole);
    const attempt=newLabAttempt(s,'directed-test');
    assert.ok(validLabEvent(JSON.parse(JSON.stringify({id:'event',attemptId:attempt.id,type:'attempt',attempt}))));
    assert.equal(nextFixedLabSpecimen(s)?.hole.courseId,LAB_DIRECTED[(i+1)%8].hole.courseId);
    assert.equal(labHoleProgress(s.hole),`${i+1}/8`);
  }
  const review={id:'feedback',attemptId:'directed-test',type:'review',review:{verdict:'keep',challenge:'setup',issue:'',note:'QA',shot:null,styleExperience:'partial',shortcutVerdict:'fun'}};
  assert.ok(validLabEvent(review));
  assert.equal(validLabEvent({...review,review:{...review.review,styleExperience:'anything'}}),false);
});

test('all three route roles independently land, preserve style and disclose shortcuts',()=>{
  for(const h of directedLabBank.holes){
    const hole=generateDirectedHole(h.levelIndex,h.stage),paints=PLAY_LEVELS[h.levelIndex].paints;
    assert.equal(h.roles.shortest.times.length,hole.solutionShots);
    const distances=paints.map((_,i)=>colorDistance(mixtureColor(paints,paints.map((_,j)=>+(i===j))),hole.target));
    assert.ok(distances[h.roles.closest.order[0]]<=Math.min(...distances)+1e-10);
    for(const r of Object.values(h.roles)){
      assert.ok(timingSupported(r));
      assert.ok(colorDistance(mixtureColor(paints,replayRoute(h.levelIndex,r.order,r.times)),hole.target)<=hole.tolerance+1e-10);
    }
    assert.ok(auditTraits(h.levelIndex,h.roles.intended,hole.target).includes(h.focus));
    assert.ok(h.coverage.robustBases.every(b=>h.coverage.availableBases.includes(b)));
    assert.ok(h.analysis.bases.every(b=>b.qualifies));
  }
});

test('palette structures are deterministic, distinct, and settle onto modeled mixtures',()=>{
  const signatures=new Set<string>();
  for(const level of PLAY_LEVELS){
    const r=paletteReveal(level.paints);
    assert.equal(r,paletteReveal(level.paints));signatures.add(r.signature);
    assert.equal(r.seeds.length,level.paints.length);
    for(const sample of r.samples.filter((_,i)=>i%23===0)){
      assert.ok(revealPosition(r,sample,0).distanceTo(new Vector3(...sample.origin.position))<1e-10);
      assert.ok(revealPosition(r,sample,1).distanceTo(new Vector3(...sample.point.position))<1e-10);
      for(const p of [.1,.3,.5,.7])assert.ok(revealPosition(r,sample,p).toArray().every(Number.isFinite));
    }
  }
  // Lab variants deliberately reuse paint sets with different hole criteria.
  assert.equal(signatures.size,new Set(PLAY_LEVELS.map(level=>JSON.stringify(level.paints.map(p=>[p.id,p.rgb,p.strength])))).size);
  assert.notEqual(paletteReveal(PLAY_LEVELS[19].paints).turn,paletteReveal(PLAY_LEVELS[20].paints).turn);
});

test('reveal camera ends directly at the playing pose without a destination stop',()=>{
  const r=paletteReveal(PLAY_LEVELS[16].paints);
  const rest=new Vector3(10,20,30),look=new Vector3(0,10,0),target=new Vector3(0,12,-10);
  const end={position:rest,quaternion:new Quaternion().setFromRotationMatrix(new Matrix4().lookAt(rest,look,new Vector3(0,1,0)))};
  for(const aspect of [.48,1,1.8]){
    const pose=planPaletteReveal(r,rest,look,target,aspect);
    assert.ok(pose(1).position.distanceTo(end.position)<1e-9);
    assert.ok(pose(1).quaternion.angleTo(end.quaternion)<1e-7);
    assert.ok(pose(.999).position.distanceTo(end.position)<.0001);
    assert.ok(pose(0).position.distanceTo(r.center)>r.radius);
    for(let i=0;i<=100;i++){
      const p=pose(i/100);assert.ok([...p.position.toArray(),...p.quaternion.toArray()].every(Number.isFinite));
      if(i>8&&i<93)assert.ok(p.position.distanceTo(pose((i-1)/100).position)>.01,'no internal stop');
    }
  }
});

test('edge fronts propagate from seeded endpoints with staggered start times',()=>{
  for(const level of PLAY_LEVELS){
    const r=paletteReveal(level.paints);
    assert.equal(r.bridgeTimings.length,r.bridges.length);
    assert.ok(new Set(r.bridgeTimings.map(t=>t.delay.toFixed(4))).size>1);
    for(const t of r.bridgeTimings){
      assert.equal(bridgeRevealRange(t,0).count,0);
      assert.deepEqual(bridgeRevealRange(t,1),{start:0,count:288});
      for(const p of [.2,.4,.6,.8]){
        const range=bridgeRevealRange(t,p);
        assert.ok(range.start>=0&&range.count>=0&&range.start+range.count<=288);
        assert.equal(range.count%6,0);
      }
    }
  }
});

test('directed palette flybys keep the destination ahead, including portrait layouts',()=>{
  for(const specimen of LAB_DIRECTED)for(const aspect of [.48,1.7]){
    const {hole,levelIndex}=specimen,player=new Vector3(...hole.start.position),target=new Vector3(...hole.target.position);
    const direction=target.clone().sub(player).normalize(),side=direction.clone().cross(new Vector3(0,1,0)).normalize();
    const rest=player.clone().addScaledVector(direction,-6.3).addScaledVector(side,2.8).add(new Vector3(0,1.8,0));
    const look=player.clone().lerp(target,Math.min(.5,4/player.distanceTo(target)));
    const pose=planPaletteReveal(paletteReveal(PLAY_LEVELS[levelIndex].paints),rest,look,target,aspect);
    const camera=new PerspectiveCamera(58,aspect,.06,700);
    for(let i=0;i<=100;i++){
      const p=pose(i/100);camera.position.copy(p.position);camera.quaternion.copy(p.quaternion);camera.updateMatrixWorld(true);
      const projected=target.clone().project(camera);
      assert.ok(projected.z<1,`target behind on ${hole.courseId} at ${i}`);
      if(i<90)assert.ok(Math.abs(projected.x)<1&&Math.abs(projected.y)<1,`target out of frame on ${hole.courseId} at ${i}: ${projected.toArray()}`);
      if(i>0)assert.ok(p.quaternion.angleTo(pose((i-1)/100).quaternion)<.1,'no sudden swivel');
    }
  }
});
