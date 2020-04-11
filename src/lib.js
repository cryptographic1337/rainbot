exports.isNumber = function (number) {
    var result = /^[0-9]*$/.test(number);
    if (result === true) {
        return number;
    } else {
        return null;
    }
};

exports.isValidUsername = function (input) {
    if (typeof input !== 'string') return false;
    if (input.length === 0) return false;
    if (input.length < 3) return false;
    if (input.length > 50) return false;
    if (!/^[a-z0-9_\-]*$/i.test(input)) return false;
    return true;
};

exports.countUnique = function (iterable) {
  return new Set(iterable).size;
}