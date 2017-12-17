const {fromJS, is} = require('immutable');
const jsondifpatch = require('../src/main');
const patcher = new jsondifpatch.DiffPatcher();

const examples = require('../test/examples/diffpatch');

const immutableFilter = require('../src/filters/immutable');
patcher.processor.pipes.diff.replace('trivial', immutableFilter.trivialDiffFilter);
patcher.processor.pipes.diff.before('objects', immutableFilter.mapDiffFilter);
patcher.processor.pipes.patch.replace('trivial', immutableFilter.patchFilter);
patcher.processor.pipes.patch.before('objects', immutableFilter.mapPatchFilter);
patcher.processor.pipes.patch.before('collectChildren', immutableFilter.childrenPatchFilter);

const example = examples.objects[5];

const diff = patcher.diff(fromJS(example.left), fromJS(example.right));
console.log('delta same', is(fromJS(example.delta), fromJS(diff)));
const result = fromJS(example.left);
const newObj = patcher.patch(result, diff);
console.log(is(newObj, fromJS(example.right)));
