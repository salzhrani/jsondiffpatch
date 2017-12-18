// jshint ignore: start
var immutable = require("immutable");
var DiffContext = require("../contexts/diff").DiffContext;
var PatchContext = require('../contexts/patch').PatchContext;
var trivial = require("./trivial");
var lcs = require('./lcs-immutable');

var ARRAY_MOVE = 3;


var isImmutable = function(obj) {
  return (
    obj &&
    ((immutable.Map.isMap(obj) && "Map") ||
      (immutable.List.isList(obj) && "List") ||
      (obj.constructor.name === "Record" && "Record"))
  );
};
const get = (obj, prop) => {
  return obj.get ? obj.get(prop) : obj[prop];
};

const length = (arr) => immutable.List.isList(arr) ? arr.size : arr.length;

const keys = (obj, cb) =>
  obj.keySeq ? obj.keySeq().forEach(cb) : Object.keys(obj).forEach(cb);

var trivialDiffFilter = function trivialMatchesDiffFilter(context) {
  if (context.left === context.right) {
    context.setResult(undefined).exit();
    return;
  }
  let type;
  if ((type = isImmutable(context.left))) {
    context.leftImmutable = true;
    context.leftType = type;
  }
  if ((type = isImmutable(context.right))) {
    context.rightImmutable = true;
    context.rightType = type;
  }
  if (!context.leftImmutable || !context.rightImmutable) {
    trivial.diffFilter(context);
    return;
  }
  if (immutable.is(context.left, context.right)) {
    context.setResult(undefined).exit();
    return;
  }
  if (typeof context.left === "undefined") {
    if (typeof context.right === "function") {
      throw new Error("functions are not supported");
    }
    context.setResult([context.right]).exit();
    return;
  }
  if (typeof context.right === "undefined") {
    context.setResult([context.left, 0, 0]).exit();
    return;
  }
  if (
    typeof context.left === "function" ||
    typeof context.right === "function"
  ) {
    throw new Error("functions are not supported");
  }
  if (context.leftType !== context.rightType) {
    context.setResult([context.left, context.right]).exit();
    return;
  }
};
trivialDiffFilter.filterName = "immutableTrivial";

var mapDiffFilter = function mapDiffFilter(context) {
  if (context.leftType !== "Map") {
    return;
  }
  var propertyFilter = context.options.propertyFilter;
  var child;
  keys(context.left, key => {
    if (!propertyFilter || propertyFilter(key, context)) {
      child = new DiffContext(get(context.left, key), get(context.right, key));
      context.push(child, key);
    }
  });
  keys(context.right, key => {
    if (!propertyFilter || propertyFilter(key, context)) {
      if (typeof get(context.left, key) === "undefined") {
        child = new DiffContext(undefined, get(context.right, key));
        context.push(child, key);
      }
    }
  });

  if (!context.children || context.children.length === 0) {
    context.setResult(undefined).exit();
    return;
  }
  context.exit();
};

mapDiffFilter.filterName = "immutableMapDiff";

var patchFilter = function trivialMatchesPatchFilter(context) {
  let type = isImmutable(context.left);
  if (type) {
    context.leftImmutable = true;
    context.leftType = type;
  }
  trivial.patchFilter(context);
  return;
};
patchFilter.filterName = "immutableTrivialPatch";

var mapPatchFilter = function mapPatchFilter(context) {
  if (!context.nested) {
    return;
  }
  if (context.delta._t) {
    return;
  }
  if (!context.leftImmutable) {
    return;
  }
  debugger;
  var name, child;
  for (name in context.delta) {
    child = new PatchContext(get(context.left, name), get(context.delta, name));
    context.push(child, name);
  }
  context.exit();
};


var childrenPatchFilter = function childrenPatchFilter(context) {
    if (!context || !context.children) {
        return;
      }
      if (context.delta._t) {
        return;
      }
      if (!isImmutable(context.left)) {
          return;
      }
      var length = context.children.length;
      var child;
      for (var index = 0; index < length; index++) {
        child = context.children[index];
        if (context.left.has(child.childName) && child.result === undefined) {
            context.left = context.left.delete(child.childName);
        } else if (context.left.get(child.childName) !== child.result) {
          context.left = context.left.set(child.childName, child.result);
        }
      }
      context.setResult(context.left).exit();
}

childrenPatchFilter.filterName = 'immutableChildrenPatchFilter';


function matchItems(array1, array2, index1, index2, context) {
  var value1 = get(array1, index1);
  var value2 = get(array2, index2);
  if (value1 === value2) {
    return true;
  }
  if (typeof value1 !== 'object' || typeof value2 !== 'object') {
    return false;
  }
  var objectHash = context.objectHash;
  if (!objectHash) {
    // no way to match objects was provided, try match by position
    return context.matchByPosition && index1 === index2;
  }
  var hash1;
  var hash2;
  if (typeof index1 === 'number') {
    context.hashCache1 = context.hashCache1 || [];
    hash1 = context.hashCache1[index1];
    if (typeof hash1 === 'undefined') {
      context.hashCache1[index1] = hash1 = objectHash(value1, index1);
    }
  } else {
    hash1 = objectHash(value1);
  }
  if (typeof hash1 === 'undefined') {
    return false;
  }
  if (typeof index2 === 'number') {
    context.hashCache2 = context.hashCache2 || [];
    hash2 = context.hashCache2[index2];
    if (typeof hash2 === 'undefined') {
      context.hashCache2[index2] = hash2 = objectHash(value2, index2);
    }
  } else {
    hash2 = objectHash(value2);
  }
  if (typeof hash2 === 'undefined') {
    return false;
  }
  return hash1 === hash2;
}

function arraysHaveMatchByRef(array1, array2, len1, len2) {
  for (var index1 = 0; index1 < len1; index1++) {
    var val1 = get(array1, index1);
    for (var index2 = 0; index2 < len2; index2++) {
      var val2 = get(array2, index2);
      if (index1 !== index2 && val1 === val2) {
        return true;
      }
    }
  }
}

var listDiffFilter = function listDiffFilter(context) {
  if (context.leftType !== 'List') {
    return;
  }
  var matchContext = {
    objectHash: context.options && context.options.objectHash,
    matchByPosition: context.options && context.options.matchByPosition
  };
  var commonHead = 0;
  var commonTail = 0;
  var index;
  var index1;
  var index2;
  var array1 = context.left;
  var array2 = context.right;
  var len1 = length(array1);
  var len2 = length(array2);

  var child;

  if (len1 > 0 && len2 > 0 && !matchContext.objectHash &&
    typeof matchContext.matchByPosition !== 'boolean') {
    matchContext.matchByPosition = !arraysHaveMatchByRef(array1, array2, len1, len2);
  }

  // separate common head
  while (commonHead < len1 && commonHead < len2 &&
    matchItems(array1, array2, commonHead, commonHead, matchContext)) {
    index = commonHead;
    child = new DiffContext(get(context.left, index), get(context.right, index));
    context.push(child, index);
    commonHead++;
  }
  // separate common tail
  while (commonTail + commonHead < len1 && commonTail + commonHead < len2 &&
    matchItems(array1, array2, len1 - 1 - commonTail, len2 - 1 - commonTail, matchContext)) {
    index1 = len1 - 1 - commonTail;
    index2 = len2 - 1 - commonTail;
    child = new DiffContext(get(context.left, index1), get(context.right, index2));
    context.push(child, index2);
    commonTail++;
  }
  var result;
  if (commonHead + commonTail === len1) {
    if (len1 === len2) {
      // arrays are identical
      context.setResult(undefined).exit();
      return;
    }
    // trivial case, a block (1 or more consecutive items) was added
    result = result || {
      _t: 'a'
    };
    for (index = commonHead; index < len2 - commonTail; index++) {
      result[index] = [get(array2, index)];
    }
    context.setResult(result).exit();
    return;
  }
  if (commonHead + commonTail === len2) {
    // trivial case, a block (1 or more consecutive items) was removed
    result = result || {
      _t: 'a'
    };
    for (index = commonHead; index < len1 - commonTail; index++) {
      result['_' + index] = [get(array1, index), 0, 0];
    }
    context.setResult(result).exit();
    return;
  }
  // reset hash cache
  delete matchContext.hashCache1;
  delete matchContext.hashCache2;

  // diff is not trivial, find the LCS (Longest Common Subsequence)
  var trimmed1 = array1.slice(commonHead, len1 - commonTail);
  var trimmed2 = array2.slice(commonHead, len2 - commonTail);
  var seq = lcs.get(
    trimmed1, trimmed2,
    matchItems,
    matchContext
  );
  var removedItems = [];
  result = result || {
    _t: 'a'
  };
  for (index = commonHead; index < len1 - commonTail; index++) {
    if (seq.indices1.indexOf(index - commonHead) < 0) {
      // removed
      result['_' + index] = [get(array1, index), 0, 0];
      removedItems.push(index);
    }
  }

  var detectMove = true;
  if (context.options && context.options.arrays && context.options.arrays.detectMove === false) {
    detectMove = false;
  }
  var includeValueOnMove = false;
  if (context.options && context.options.arrays && context.options.arrays.includeValueOnMove) {
    includeValueOnMove = true;
  }

  var removedItemsLength = removedItems.length;
  for (index = commonHead; index < len2 - commonTail; index++) {
    var indexOnArray2 = seq.indices2.indexOf(index - commonHead);
    if (indexOnArray2 < 0) {
      // added, try to match with a removed item and register as position move
      var isMove = false;
      if (detectMove && removedItemsLength > 0) {
        for (var removeItemIndex1 = 0; removeItemIndex1 < removedItemsLength; removeItemIndex1++) {
          index1 = removedItems[removeItemIndex1];
          if (matchItems(trimmed1, trimmed2, index1 - commonHead,
            index - commonHead, matchContext)) {
            // store position move as: [originalValue, newPosition, ARRAY_MOVE]
            result['_' + index1].splice(1, 2, index, ARRAY_MOVE);
            if (!includeValueOnMove) {
              // don't include moved value on diff, to save bytes
              result['_' + index1][0] = '';
            }

            index2 = index;
            child = new DiffContext(get(context.left, index1), get(context.right, index2));
            context.push(child, index2);
            removedItems.splice(removeItemIndex1, 1);
            isMove = true;
            break;
          }
        }
      }
      if (!isMove) {
        // added
        result[index] = [get(array2, index)];
      }
    } else {
      // match, do inner diff
      index1 = seq.indices1[indexOnArray2] + commonHead;
      index2 = seq.indices2[indexOnArray2] + commonHead;
      child = new DiffContext(get(context.left, index1), get(context.right, index2));
      context.push(child, index2);
    }
  }

  context.setResult(result).exit();

};
listDiffFilter.filterName = 'lists';

var compare = {
  numerically: function(a, b) {
    return a - b;
  },
  numericallyBy: function(name) {
    return function(a, b) {
      return get(a, name) - get(b, name);
    };
  }
};

var listPatchFilter = function nestedPatchFilter(context) {
  if (!context.nested) {
    return;
  }
  debugger;
  if (context.delta._t !== 'a') {
    return;
  }
  if (context.leftType !== 'List') {
    return;
  }

  var index, index1;

  var delta = context.delta;
  var array = context.left;

  // first, separate removals, insertions and modifications
  var toRemove = [];
  var toInsert = [];
  var toModify = [];
  for (index in delta) {
    if (index !== '_t') {
      if (index[0] === '_') {
        // removed item from original array
        if (delta[index][2] === 0 || delta[index][2] === ARRAY_MOVE) {
          toRemove.push(parseInt(index.slice(1), 10));
        } else {
          throw new Error('only removal or move can be applied at original array indices' +
            ', invalid diff type: ' + delta[index][2]);
        }
      } else {
        if (delta[index].length === 1) {
          // added item at new array
          toInsert.push({
            index: parseInt(index, 10),
            value: delta[index][0]
          });
        } else {
          // modified item at new array
          toModify.push({
            index: parseInt(index, 10),
            delta: delta[index]
          });
        }
      }
    }
  }

  // remove items, in reverse order to avoid sawing our own floor
  toRemove = toRemove.sort(compare.numerically);
  for (index = toRemove.length - 1; index >= 0; index--) {
    index1 = toRemove[index];
    var indexDiff = delta['_' + index1];

    var removedValue = get(array, index1);
    array = array.splice(index1, 1);
    if (indexDiff[2] === ARRAY_MOVE) {
      // reinsert later
      toInsert.push({
        index: indexDiff[1],
        value: removedValue
      });
    }
  }

  // insert items, in reverse order to avoid moving our own floor
  toInsert = toInsert.sort(compare.numericallyBy('index'));
  var toInsertLength = toInsert.length;
  for (index = 0; index < toInsertLength; index++) {
    var insertion = toInsert[index];
    array = array.splice(insertion.index, 0, insertion.value);
  }

  // apply modifications
  var toModifyLength = toModify.length;
  var child;
  if (toModifyLength > 0) {
    for (index = 0; index < toModifyLength; index++) {
      var modification = toModify[index];
      child = new PatchContext(context.left[modification.index], modification.delta);
      context.push(child, modification.index);
    }
  }

  if (!context.children) {
    context.setResult(array).exit();
    return;
  }
  context.exit();
};
listPatchFilter.filterName = 'list';

var reverseFilter = function trivialReferseFilter(context) {
  if (typeof context.delta === "undefined") {
    context.setResult(context.delta).exit();
    return;
  }
  context.nested = !isArray(context.delta);
  if (context.nested) {
    return;
  }
  if (context.delta.length === 1) {
    context.setResult([context.delta[0], 0, 0]).exit();
    return;
  }
  if (context.delta.length === 2) {
    context.setResult([context.delta[1], context.delta[0]]).exit();
    return;
  }
  if (context.delta.length === 3 && context.delta[2] === 0) {
    context.setResult([context.delta[0]]).exit();
    return;
  }
};
reverseFilter.filterName = "immutable";

exports.trivialDiffFilter = trivialDiffFilter;
exports.patchFilter = patchFilter;
exports.mapDiffFilter = mapDiffFilter;
exports.mapPatchFilter = mapPatchFilter;
exports.reverseFilter = reverseFilter;
exports.childrenPatchFilter = childrenPatchFilter;
exports.listDiffFilter = listDiffFilter;
exports.listPatchFilter = listPatchFilter;
/* eslint-enable */
