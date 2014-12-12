# koa-rethinkdb-pool

Middleware that manages RethinkDB connections in a Koa application.

It provides functions on the Koa request context that allocate a connection when
necessary and manage closing that connection when the request completes.

## Example Usage

During startup, initialize the package with the RethinkDB instance and the
connection information.

Supplying the RethinkDB instance ensures that your project is control of the
RethinkDB package version.  The connection information is simply the object
passed to RethinkDB's connect function.

```javascript
var rethinkdb = require('rethinkdb');

var pool = require('koa-rethinkdb-pool');

app.use(pool({
  r: rethinkdb,
  connectOptions: {
    host: 'localhost',
    port: 28015,
    db: 'test'
    }
}));
```

This installs middleware that will add the following functions to the Koa
context:

* connection() - Return a Koa connection.
* execute(query) - Execute a query and return the result.
* fetchone(query) - Execute a query and return the first result value or `null`.
* fetchall(query) - Execute a query and return an array of results.

```javascript
var r = require('rethinkdb');

app.post('/api/get', function*() {
  // Return all user objects
  this.body = yield this.fetchall(r.table('users'));
});

app.post('/api/getone', function*() {
  // Return the user object with id 1 or null if it doesn't exist.
  this.body = yield this.fetchone(r.table('users').get(1));
});

app.post('/api/insert', function*() {
  var result = yield this.execute(r.table('users').insert({ id: 7, name: 'seven' });
});
```

In each of these cases, a connection was allocated and attached to the request
context (`this`).  After the request completes, the middleware detects the
connection and closes it.

Since the connection is attached to the request context, multiple calls will use
the same connection:

```javascript
app.post('/api/test', function*() {

  // This first call to execute makes the connection
  var result = yield this.execute(r.table('users').insert({ id: 7, name: 'seven' });

  // This will use the same connection.
  var row = yield this.execute(r.table('users').get(7));
});
```

## API

### package initialization

Requiring the package returns a setup function.  The function accepts a single
options hash that must contain:

* `r` - The RethinkDB instance to use.
* `connectOptions` - A JSON object passed to RethinkDB's connect when a
connection is needed.

### `connection()`

Returns the context's connection, allocating it if necessary.  Subsequent calls
within the same request always return the same connection.

### `execute(query)`

Executes a query (which can be an insert or an update) and returns its result.

This is effectively `return yield query.run(cnxn)`.  The result is whatever `run
returns.

### `fetchone(query)`

Executes a query and returns the first result object or `null` if there are no
objects.

This is designed for "select"-type queries that you expect to return a single
object.  It is a convenience wrapper that extracts the first element from the
results and returns it.  It returns `null` if the query did not return a result.

This method is designed for queries that return a cursor, but if the result is
not a cursor, the result is returned directly.

### `fetchall(query)`

Executes a query and returns the results as an array.  If the query does not
return results, an empty array is returned.

This method is designed for queries that return a cursor, but if the result is
not a cursor, the result is returned directly.  However, if the query does not
return a cursor you should probably use `execute` instead for clarity.

## Pooling

This package will eventually provide a connection pool, but the basic API here
will not change.  At this time, a new connection is created when necessary.
