// Post-hoc diagnostic, separate from the frozen palette-selection/holdout cohort.
// These two training examples test the user's close-but-indirect hypothesis;
// they must not be presented as independently selected validation examples.
import {writeFileSync} from 'node:fs';
import {PLAY_LEVELS} from '../app/play-engine';
import {makeAtlas} from '../app/play-course-analysis';
import {analyzeJourney} from '../app/play-journey-analysis';

const recipes=[
 [.3102548964409965,.19160222374428842,.31129051146520603,.18685236834950888],
 [.3249385905028449,.20067034311099116,.2786953790655465,.19569568732061746],
];
const palette=1,atlas=makeAtlas(palette,512,96),started=performance.now();
const items=recipes.map((recipe,i)=>{
 const audit=analyzeJourney(palette,recipe,atlas,20261119);
 console.log('CLOSE',i,JSON.stringify(audit.bases[0].approach),JSON.stringify(audit.styles),audit.failures);
 return {id:`close-zorn-${i}`,recipe,audit};
});
writeFileSync('docs/play-close-start-check.json',JSON.stringify({
 purpose:'Post-hoc close-start diagnostic; separate from frozen palette selection. No thresholds changed.',
 palette:PLAY_LEVELS[palette],resolution:'513 one-dose / 97×97 two-dose / bounded three-dose multistart',
 seconds:(performance.now()-started)/1000,items},null,2)+'\n');
