const {fromJS, is} = require('immutable');
const jsondifpatch = require('../src/main');
let patcher = new jsondifpatch.DiffPatcher();

const examples = require('../test/examples/diffpatch');

const immutableFilter = require('../src/filters/immutable');
patcher.processor.pipes.diff.replace('trivial', immutableFilter.trivialDiffFilter);
patcher.processor.pipes.diff.before('arrays', immutableFilter.listDiffFilter);
patcher.processor.pipes.diff.before('objects', immutableFilter.mapDiffFilter);
patcher.processor.pipes.patch.replace('trivial', immutableFilter.patchFilter);
patcher.processor.pipes.patch.before('objects', immutableFilter.mapPatchFilter);
patcher.processor.pipes.patch.before('collectChildren', immutableFilter.childrenPatchFilter);

const example = examples.objects[5];

const diff = patcher.diff(fromJS(example.left), fromJS(example.right));
// console.log('delta same', is(fromJS(example.delta), fromJS(diff)));
const result = fromJS(example.left);
const newObj = patcher.patch(result, diff);
// console.log(is(newObj, fromJS(example.right)));

const arrExample = examples.arrays[12];
debugger;
patcher = new jsondifpatch.DiffPatcher(Object.assign({}, arrExample.options, {}));
patcher.processor.pipes.diff.replace('trivial', immutableFilter.trivialDiffFilter);
patcher.processor.pipes.diff.before('arrays', immutableFilter.listDiffFilter);
patcher.processor.pipes.diff.before('objects', immutableFilter.mapDiffFilter);
patcher.processor.pipes.patch.replace('trivial', immutableFilter.patchFilter);
patcher.processor.pipes.patch.before('arrays', immutableFilter.listPatchFilter);
patcher.processor.pipes.patch.before('objects', immutableFilter.mapPatchFilter);
patcher.processor.pipes.patch.before('collectChildren', immutableFilter.childrenPatchFilter);

const aDiff = patcher.diff(fromJS(arrExample.left), fromJS(arrExample.right));
console.log(aDiff, arrExample.delta);
console.log(is(fromJS(aDiff), fromJS(arrExample.delta)));

const newArr = patcher.patch(fromJS(arrExample.left), aDiff);
console.log('right', arrExample.right);
console.log('newArr', newArr.toJS());
console.log(is(newArr, fromJS(arrExample.right)));