const
    events = require('events'),
    url = require('url'),
    http = require('http');


var create_osm_client = function (osm_baseurl, osm_request_type, osm_request_path, max_connections) {
    var client = Object.create(new events.EventEmitter, {});
    
    var default_max_connections = 128;
    if (typeof max_connections === 'undefined') {
        console.log("setting the maximum number of connections to the default: " + default_max_connections);
        max_connections = default_max_connections;
    }

    var osm_parts = url.parse(osm_baseurl);
    var osm_port = osm_parts.port,
        osm_hostname = osm_parts.hostname,
        osm_path = osm_parts.pathname.replace(/\/$/, "");

    client.hostname = osm_hostname;
    client.port = osm_port;
    client.path = osm_path;
    client.request_type = osm_request_type;
    client.request_path = client.path + osm_request_path;

    var throttle = function () {
        var self = {};
        var waitlist = [];
        var connection_count = 0;
        
        var check_waitlist;
        var process_request;

        check_waitlist = function () {
            if (waitlist.length > 0 && connection_count < max_connections) {
                connection_count++;
                process_request(waitlist.shift());
            }
        };

        process_request = function (parms) {
            console.log("Trying to connect to OSM at " + parms.host + ":" + parms.port);

            var options = {
                host: parms.host,
                port: parms.port,
                path: parms.path,
                method: parms.method
            }

            var req = http.request(options, function (res) {
                var data = '';
                res.on('data', function (chunk) {
                    data += chunk;
                });
                res.on('end', function () {
                    parms.callback(res.statusCode, data);
                    connection_count--;
                    check_waitlist();
                });
            });

            req.on('error', function (e) {
                console.log("problem with request to " + parms.host + ": " + e.message);
            });

            if (typeof parms.body !== 'undefined') {
                console.log("sending " + parms.method + " body " + parms.path);
                req.write(parms.body);
            }
            req.end();
        };

        self.submit = function (parms) {
            waitlist.push(parms);
            check_waitlist();
        }

        return self;
    }();

    client.post_osm_update = function (new_state, object_id) {
        var self = this;

        var update_path = self.path + '/jobs/' + object_id;
        var update_data = JSON.stringify(new_state);

        throttle.submit({
            port: self.port,
            host: self.hostname,
            path: update_path,
            method: 'POST',
            body: update_data,
            callback: function (status, data) {
                console.log("Got a " + status + " from the OSM after POSTing TO " + update_path);
                self.emit('updated', status, data);
            }
        });
    };

    client.lookup_analysis = function (analysis_uuid) {
        var self = this;
        var query = JSON.stringify({"state.uuid" : analysis_uuid});
        
        throttle.submit({
            port: self.port,
            host: self.hostname,
            path: self.request_path,
            method: self.request_type,
            body: query,
            callback: function (status, data) {
                console.log("Got a " + status + " fom the OSM when looking up Analysis " + analysis_uuid);
                self.emit('analysis', status, data);
            }
        });
    };

    return client;
};

exports.create_osm_client = create_osm_client;
