// jshint ignore: start
var immutable = require("immutable");
var DiffContext = require("../contexts/diff").DiffContext;
var PatchContext = require('../contexts/patch').PatchContext;
var trivial = require("./trivial");
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
/* eslint-enable */
