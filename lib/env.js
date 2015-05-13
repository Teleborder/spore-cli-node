var merge = require('merge'),
    debug = require('debug')('spore-cli'),
    async = require('async'),
    Errors = require('./errors'),
    SporeCell = require('./cell'),
    resolvePath = require('./utils/resolve_path');

module.exports = SporeEnv;

function SporeEnv(app, name, ids) {
  var self = this;
  this.app = app;
  this.name = name;
  this.cells = [];

  Object.keys(ids || {}).forEach(function (key) {
    self.cells.push(new self.constructor.Cell(self, key, ids[key]));
  });

  debug(name + " environment initialized");
}

SporeEnv.Cell = SporeCell;

SporeEnv.prototype.toJSON = function () {
  var json = {};
  this.cells.forEach(function (cell) {
    json = merge(json, cell.toJSON());
  });
  return json;
};

SporeEnv.prototype.path = function () {
  return resolvePath(this.app.path(), this.name);
};

SporeEnv.prototype.fullName = function () {
  return this.app.fullName() + "/" + this.name;
};

SporeEnv.prototype.values = function (callback) {
  debug("Loading values for the " + this.name + " environment");

  if(!this.cells.length) {
    process.nextTick(function () {
      callback(null, {});
    });
    return;
  }

  async.mapLimit(this.cells, 100, function (cell, next) {
    cell.getValue(next);
  }, function (err, vals) {
    if(err) return callback(err);

    callback(null, merge.apply(null, vals));
  });
};

SporeEnv.prototype.newCell = function (key, id) {
  var cell = new this.constructor.Cell(this, key, id);
  this.cells.push(cell);
  return cell;
};

SporeEnv.prototype.findCellByKey = function (key) {
  for(var i=0; i<this.cells.length; i++) {
    if(this.cells[i].key === key) return this.cells[i];
  }

  return this.newCell(key);
};

SporeEnv.prototype.set = function (key, value, callback) {
  debug("Setting " + key);

  var cell = this.findCellByKey(key);

  return cell.setValue(value, callback);
};
