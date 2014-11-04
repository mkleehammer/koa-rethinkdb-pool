
"use strict";

/*global describe,before,beforeEach,it */

var assert = require('chai').assert;

var r = require('rethinkdb');
var co = require('co');

var middleware = require('../index');

describe('middleware', function() {
  /*jshint validthis:true */

  var wrapper;
  var ctx;

  beforeEach(function() {
    // Generate a new middleware instance for each test.
    wrapper = middleware({ r: r });
    ctx = {};
  });

  it('should add methods', function(done) {
    co(function*() {

      function* next() {
      }
      yield wrapper.call(ctx, next);

      assert.isFunction(ctx.connection);
      assert.isFunction(ctx.execute);
      assert.isFunction(ctx.fetchone);
      assert.isFunction(ctx.fetchall);

    }).call(ctx, done);
  });

  it('should keep the connection', function(done) {

    co(function* () {
      function* next() {
        var a = yield this.fetchone(r.tableList());
      }

      yield wrapper.call(ctx, next);

      assert.isObject(ctx._rethinkdb_cnxn);

    }).call(ctx, done);
  });

  it('should reuse the connection', function(done) {
    co(function*() {

      var cnxn1, cnxn2;
      function* next() {
        cnxn1 = yield this.connection();
        cnxn2 = yield this.connection();
      }
      yield wrapper.call(ctx, next);

      assert.strictEqual(cnxn1, cnxn2);
    }).call(ctx, done);
  });
});

describe('fetchone', function() {
  /*jshint validthis:true */

  var wrapper;
  var ctx;

  before(createTable);

  beforeEach(function() {
    wrapper = middleware({ r: r });
    ctx = {};
  });

  it('should return null', function(done) {
    co(function*() {

      var result;
      function* next() {
        result = yield this.fetchone(r.table('koa_rethinkdb').get('bogus'));
      }
      yield wrapper.call(ctx, next);

      assert.isNull(result);

    }).call(ctx, done);
  });

  it('should return ints', function(done) {
    co(function* () {
      var result;
      function* next() {
        result = yield this.fetchone(
          r.table('koa_rethinkdb')
            .filter({ id: 'bogus' })
            .count()
        );
      }
      yield wrapper.call(ctx, next);
      assert.strictEqual(result, 0);
    }).call(ctx, done);
  });

  it('should pass through arrays', function(done) {
    co(function* () {
      var result;
      function* next() {
        result = yield this.fetchone(r.tableList());
      }
      yield wrapper.call(ctx, next);
      assert.isArray(result);
    }).call(ctx, done);
  });

  it('should return a row', function(done) {
    co(function*() {
      var result;
      function* next() {
        result = yield this.fetchone(
          r.table('koa_rethinkdb')
            .filter({ id: '1' })
          );
      }
      yield wrapper.call(ctx, next);
      assert.deepEqual({ id: '1', val: 'one' }, result);
    }).call(ctx, done);
  });
});


describe('fetchall', function() {
  /*jshint validthis:true */

  var wrapper;
  var ctx;

  before(createTable);

  beforeEach(function() {
    wrapper = middleware({ r: r });
    ctx = {};
  });

  it('should return null', function(done) {
    co(function*() {

      var result;
      function* next() {
        result = yield this.fetchall(r.table('koa_rethinkdb').get('bogus'));
      }
      yield wrapper.call(ctx, next);

      assert.isNull(result);

    }).call(ctx, done);
  });

  it('should return ints', function(done) {
    co(function* () {
      var result;
      function* next() {
        result = yield this.fetchall(
          r.table('koa_rethinkdb')
            .filter({ id: 'bogus' })
            .count()
        );
      }
      yield wrapper.call(ctx, next);
      assert.strictEqual(result, 0);
    }).call(ctx, done);
  });

  it('should pass through arrays', function(done) {
    co(function* () {
      var result;
      function* next() {
        result = yield this.fetchall(r.tableList());
      }
      yield wrapper.call(ctx, next);
      assert.isArray(result);
    }).call(ctx, done);
  });

  it('should coerce streams', function(done) {
    co(function*() {
      var result;
      function* next() {
        result = yield this.fetchall(
          r.table('koa_rethinkdb')
        );
      }
      yield wrapper.call(ctx, next);
      assert.isArray(result);
    }).call(ctx, done);
  });
});


describe('execute', function() {
  /*jshint validthis:true */

  var wrapper;
  var ctx;

  before(createTable);

  beforeEach(function() {
    // Generate a new middleware instance for each test.
    wrapper = middleware({ r: r });
    ctx = {};
  });

  it('should remember cursors', function(done) {
    co(function*() {

      var cursor;

      function* next() {
        cursor = yield this.execute(r.table('koa_rethinkdb'));
      }

      yield wrapper.call(ctx, next);

      assert.strictEqual(ctx._rethinkdb_cursors.length, 1);
      assert.strictEqual(ctx._rethinkdb_cursors[0], cursor);

    }).call(ctx, done);
  });
});

function createTable(done) {
  co(function*() {
    var cnxn = yield r.connect();
    try { yield r.tableDrop('koa_rethinkdb').run(cnxn); } catch (error) { /* already exists? */ }
    yield r.tableCreate('koa_rethinkdb').run(cnxn);
    yield r.table('koa_rethinkdb').insert([
      { id: '1', val: 'one' },
      { id: '2', val: 'two' },
      { id: '3', val: 'three' }
    ]).run(cnxn);
    yield cnxn.close();
  }).call(null, done);
}
