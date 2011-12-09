const events = require('events');
const http = require('http');
const url = require('url');

/*
 * Provides some encapsulation for simple HTTP requests.
 */
exports.create = function() {
    var http_url_getter = Object.create(new events.EventEmitter, {});

    /*
     * Creates an HTTP client that can be used to connect to the host and port
     * specified in the given parsed URL.
     *
     * params:
	 *   self - the HTTP URL getter.
     *   parsed_url - the parsed version of the URL.
     * returns:
     *   the HTTP client.
     */
    var create_client = function(self, parsed_url) {
		var port = parsed_url.port || 80;
		var host = parsed_url.hostname;
		var client = http.createClient(port, host);
		client.on('error', function(err) {
			var a_url = url.format(parsed_url);
			var msg = 'unable to connct to host at ' + a_url + ': ' + err;
			self.emit('error', msg);
		});
		return client;
	}

    /*
     * Creates an HTTP client request that can be used to act upon the resource
     * specified in the given parsed URL.
     *
     * params:
     *   client     - the HTTP client.
     *   parsed_url - the parsed version of the URL.
     *   method     - the HTTP request method.
     * returns:
     *   the HTTP request object.
     */
    var create_request = function(client, parsed_url, method) {
		var path = parsed_url.pathname || '/';
		var query = parsed_url.query || '';
		var hash = parsed_url.hash || '';
		var host = parsed_url.hostname;
		return client.request(method, path + query + hash, {
		    'Host': host,
		    'Content-Type': 'application/json'
		});
    }

    /*
     * Sends the body of the HTTP request.
     *
     * params:
     *   request - the HTTP request object.
     *   body    - the HTTP request body.
     */
    var send_request_body = function(request, body) {
        if (typeof(body) !== 'undefined' && body !== null) {
    		request.end(body, 'utf8');
        }
        else {
            request.end();
        }
    }

    /*
	 * Sends a request to a given URL.
	 *
	 * params:
	 *     self   - the HTTP url getter that is making the request.
	 *     a_url  - the URL to send the request to.
	 *     method - the HTTP method to use in the request.
	 *     body   - the request body.
	 * returns:
	 *     the client request.
	 */
	var send_request = function(self, a_url, method, body) {
		var parsed_url = url.parse(a_url);
		var client = create_client(self, parsed_url);
		var request = create_request(client, parsed_url, method);
		send_request_body(request, body);
		return request;
	};

	/*
	 * Obtains an HTTP response body.
	 *
	 * params:
	 *     self     - the OSM client made the request.
	 *     response - the response object.
	 */
	var get_response_body = function(self, res) {
		var body = '';
		res.on('data', function(chunk) {
			body += chunk;
		});
		res.on('end', function() {
			self.emit('response', body);
		});
	};

    /*
     * Sends an HTTP request to a server and retrieves the response.  When the
     * response arrives, a 'response' event is emitted containing the body of
     * the response.  If a connection to the server can't be established or if
     * the server returns a status code other than 200 then an 'error' event is
     * emitted.
     *
     * params:
     *   a_url  - the URL to send the request to.
     *   method - the HTTP method to use for the request.
     *   body   - the request body.
     */
    http_url_getter.get_resource = function(a_url, method, body) {
        var self = this;
        var request = send_request(self, a_url, method, body);
        request.on('response', function(response) {
            var status_code = response.statusCode;
            if (status_code === 200) {
                get_response_body(self, response);
            }
            else {
                var msg = "server returned status code: " + status_code;
                self.emit('error', msg);
            }
        });
    }

    return http_url_getter;
}
