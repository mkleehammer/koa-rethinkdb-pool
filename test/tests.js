
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
    co.call(ctx, function*() {
      function* next() {
      }
      yield wrapper.call(ctx, next);

      assert.isFunction(ctx.connection);
      assert.isFunction(ctx.execute);
      assert.isFunction(ctx.fetchone);
      assert.isFunction(ctx.fetchall);

    })
      .then(done)
      .catch(done);
  });

  it('should keep the connection', function(done) {

    co.call(ctx, function* () {
      function* next() {
        var a = yield this.fetchone(r.tableList());
      }

      yield wrapper.call(ctx, next);

      assert.isObject(ctx._rethinkdb_cnxn);

    })
      .then(done)
      .catch(done);

  });

  it('should reuse the connection', function(done) {
    co.call(ctx, function*() {

      var cnxn1, cnxn2;
      function* next() {
        cnxn1 = yield this.connection();
        cnxn2 = yield this.connection();
      }
      yield wrapper.call(ctx, next);

      assert.strictEqual(cnxn1, cnxn2);
    })
      .then(done)
      .catch(done);

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

  it('should raise an error on failed update', function(done) {
    function* next() {
      return yield this.execute(
        r.table('koa_rethinkdb').get('1')
          .update({
            bogus: r.row('bogus').append(1)
          })
      );
    }

    co.call(ctx, function*() {
      return yield next.call(ctx);
    })
      .then(function(result) {
        done(new Error('Did not throw error: ' + result));
      })
      .catch(function(err) { done(); });
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

  it('should raise an error on failed update', function(done) {
    co.call(ctx, function*() {
      function* next() {
        return yield this.fetchone(
          r.table('bogus').get('1')
        );
      }
      return yield wrapper.call(ctx, next);
    })
      .then(function(result) {
        done(new Error('Did not throw error: ' + result));
      })
      .catch(function(err) {
        done();
      });
  });

  it('should return null', function(done) {
    co.call(ctx, function*() {

      var result;
      function* next() {
        result = yield this.fetchone(r.table('koa_rethinkdb').get('bogus'));
      }
      yield wrapper.call(ctx, next);

      assert.isNull(result);

    })
      .then(done)
      .catch(done);

  });

  it('should return ints', function(done) {
    co.call(ctx, function* () {
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
    })
      .then(done)
      .catch(done);

  });

  it('should pass through arrays', function(done) {
    co.call(ctx, function* () {
      var result;
      function* next() {
        result = yield this.fetchone(r.tableList());
      }
      yield wrapper.call(ctx, next);
      assert.isArray(result);
    })
      .then(done)
      .catch(done);

  });

  it('should return a row', function(done) {
    co.call(ctx, function*() {
      var result;
      function* next() {
        result = yield this.fetchone(
          r.table('koa_rethinkdb')
            .filter({ id: '1' })
          );
      }
      yield wrapper.call(ctx, next);
      assert.deepEqual({ id: '1', val: 'one' }, result);
    })
      .then(done)
      .catch(done);

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
    co.call(ctx, function*() {

      var result;
      function* next() {
        result = yield this.fetchall(r.table('koa_rethinkdb').get('bogus'));
      }
      yield wrapper.call(ctx, next);

      assert.isNull(result);

    })
      .then(done)
      .catch(done);

  });

  it('should return ints', function(done) {
    co.call(ctx, function* () {
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
    })
      .then(done)
      .catch(done);

  });

  it('should pass through arrays', function(done) {
    co.call(ctx, function* () {
      var result;
      function* next() {
        result = yield this.fetchall(r.tableList());
      }
      yield wrapper.call(ctx, next);
      assert.isArray(result);
    })
      .then(done)
      .catch(done);
  });

  it('should coerce streams', function(done) {
    co.call(ctx, function*() {
      var result;
      function* next() {
        result = yield this.fetchall(
          r.table('koa_rethinkdb')
        );
      }
      yield wrapper.call(ctx, next);
      assert.isArray(result);
    })
      .then(done)
      .catch(done);

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
  })
    .then(function() { done(); })
    .catch(done);
}
