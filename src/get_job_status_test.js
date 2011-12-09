#!/usr/local/bin/node

var osmclient = require('./osmclient');

var osm_client = osmclient.create('http://10.130.64.115:9000', 'jobs');
var status = {'uuid': 'a6f97f256-89fb-4d70-9076-d79344c5b7f4'};
osm_client.update_job_status(status);
