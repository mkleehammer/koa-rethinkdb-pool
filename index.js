
"use strict";

var debug = require('debug')('koa-rethinkdb');

var debugCounter = 0;

module.exports = function(options) {
  /*jshint validthis:true */

  var r = options.r;
  // This is required to be passed in so that koa-rethinkdb uses your projects version of the
  // RethinkDB driver.

  var connectOptions = options.connectOptions;
  // The database connection

  function* connection() {
    // Return the connection assigned to this request, allocating one if necessary.

    if (!this._rethinkdb_cnxn) {
      this._rethinkdb_counter = (++debugCounter);

      debug('[%d] connecting', this._rethinkdb_counter);
      this._rethinkdb_cnxn = yield r.connect(connectOptions);
      this._rethinkdb_cursors = [];
      debug('[%d] connected', this._rethinkdb_counter);
    } else {
      debug('[%d] use existing', this._rethinkdb_counter);
    }

    return this._rethinkdb_cnxn;
  }

  function isCursor(obj) {
    // TODO: Suggest an r.isCursor() API or something similar.
    return obj != null && obj._conn != null;
  }

  function* execute(query) {
    // Executes a RethinkDB query.

    var cnxn = yield this.connection(); // ensures the counter is allocated before debug logging

    debug('[%d] execute %s', this._rethinkdb_counter, query);

    var result = yield query.run(cnxn);

    if (isCursor(result))
      this._rethinkdb_cursors.push(result);

    return result;
  }

  function* fetchone(query) {
    // Executes a query and returns the first result row or `null` if there are no rows.
    //
    // This is designed for use with queries that result in rows, but if the result is null or
    // an object, the result is returned as is.

    var cnxn = yield this.connection(); // ensures the counter is allocated before debug logging

    debug('[%d] fetchone %s', this._rethinkdb_counter, query);

    var result = yield query.run(cnxn);

    // A query can return:
    // * null - A get(pk) that does not find a row
    // * object - A get(pk) that does find a row
    // * cursor - A query that *can* return multiple rows.  (The cursor may be empty, however.)

    if (!isCursor(result)) {
      debug('[%d] fetchone found %d', this._rethinkdb_counter, result == null ? 0 : 1);
      return result;
    }

    try {
      // This method is designed for queries that return 0 or 1 rows so toArray is probably
      // efficient enough for now.  I wish .next() simply returned null when out of data.

      var rows = yield result.toArray();
      debug('[%d] fetchone found %d', this._rethinkdb_counter, rows.length);

      // Unlike most languages, Javascript doesn't have an assertion that can be turned off in
      // production efficiently.
      //
      // console.assert(rows.length < 2, "fetchone returned " + rows.length + " rows: " + query);

      return rows.length > 0 ? rows[0] : null;
    } finally {
      yield result.close();
    }
  }

  function* fetchall(query) {
    // Executes a query and returns its result.  If the result is a stream it is first
    // converted to an array.
    //
    // This is designed for use with queries that result in rows, but if the result is null or
    // an object, the result is returned as is.

    var cnxn = yield this.connection();

    debug('[%d] fetchall: %s', this._rethinkdb_counter, query);

    var result = yield query.run(this._rethinkdb_cnxn);

    // // Not a cursor?  Did you mean to call fetchone() instead?
    // console.assert(result && typeof result.toArray === 'function', "fetchall did not return a cursor: query=" +
    //                query + " result=" + result + " (" + (typeof result) + ")");
    //

    if (!isCursor(result))
      return result;

    try {
      var rows = yield result.toArray();
      debug('[%d] fetchall found %d', this._rethinkdb_counter, rows.length);
      return rows;
    } finally {
      yield result.close();
    }
  }

  return function* koaRethinkDB(next) {
    // The middleware request wrapper.

    // Augment the context with functions available to the user.

    this.connection = connection;
    this.execute    = execute;
    this.fetchone   = fetchone;
    this.fetchall   = fetchall;

    // Run the original request handler.

    yield next;

    // Cleanup any cursors and connections that were allocated.

    if (this._rethinkdb_cnxn) {
      for (var i = 0, c = this._rethinkdb_cursors.length; i < c; i++) {
        try {
          // Is there any way to tell if a cursor has been closed?
          yield this._rethinkdb_cursors[i].close();
        } catch (error) {
          debug('[%d] an error occurred closing a cursor.  Could simply have been closed already.  error=%s',
                this._rethinkdb_counter, error);
        }
      }

      try {
        debug('[%d] closing', this._rethinkdb_counter);
        yield this._rethinkdb_cnxn.close();
      } catch (error) {
        debug('[%d] an error occurred closing a connection: %s', this._rethinkdb_counter, error);
      }
    }
  };
};
