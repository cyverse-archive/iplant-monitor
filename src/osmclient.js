const events = require('events');
const http_url_getter = require('./http_url_getter');
const sys = require('sys');

/*
 * A table used to translate the states provided by Stork to the corresponding
 * states in the OSM.  A default OSM state of "Unknown" is used in cases where
 * the state provided by Stork isn't recognized.
 */
const STATUS_TRANSLATIONS = {
	'request_received': 'Submitted',
	'request_completed': 'Completed',
	'request_removed': 'Failed',
    'request_failed' : 'Failed',
	'default': 'Unknown'
};

exports.create_stork_tracker = function (osm_base_url, osm_stork_bucket) {
	var client = Object.create(new events.EventEmitter, {});
	
	client.get_new_tracker = function () {
		return {
			"joblist" : "stork",
			"requests" : {
				"received" : [],
				"running" : [],
				"failed" : [],
				"completed" : []
			}
		};
	}
	
	client.add_received_job = function (dap_id, analysis_id, analysis_node) {
		var self = this;
		
		console.log("Trying to add a scheduled Stork job to the tracking object in the OSM.");
		
		var job_obj = {
			"dap_id" : dap_id,
			"analysis_id" : analysis_id,
			"analysis_node" : analysis_node
		};
		
		var query_tracking_obj = {"state.joblist" : "stork"};
		var query_url = osm_base_url + "/" + osm_stork_bucket + "/query";
		var query_requester = http_url_getter.create();

		console.log("Connecting to " + query_url + " to get the tracking object.");
		query_requester.get_resource(query_url, 'POST', JSON.stringify(query_tracking_obj));
		
		query_requester.on('error', function (msg) {
			console.log("Error querying for tracking object: " + msg);
		});
		
		query_requester.on('response', function (body) {
			var resp_objs = JSON.parse(body);
			
			if (resp_objs.objects.length === 0) {
				console.log("No tracking object found, adding a new one.");
				var update_url = osm_base_url + "/" + osm_stork_bucket;
				var osm_obj = self.get_new_tracker();
			} else {
				console.log("Tracking object found, updating it.");
				var osm_doc = resp_objs.objects[0];
				var osm_obj = osm_doc.state;
				var update_url = osm_base_url + "/" + osm_stork_bucket + "/" + osm_doc.object_persistence_uuid; 
			}
			
			console.log("Adding Stork ID " + dap_id + " to the tracking object for Analysis " + analysis_id);
			osm_obj.requests.received.push(job_obj);
			
			console.log("Pushing updated tracking object to the OSM.")
			var tracker_updater = http_url_getter.create();
			tracker_updater.get_resource(update_url, 'POST', JSON.stringify(osm_obj));
			
			query_requester.on('error', function (msg) {
				console.log("Error updating tracking object: " + msg);
			});
			
			query_requester.on("response", function (body) {
				console.log("Response from updating tracking object:\n" + body)
			});
		});
	};
	
	client.get_tracking_obj = function () {
		var self = this;
		
		console.log("Retrieving Stork tracking object from the OSM.");
		
		var query_obj = {"state.joblist" : "stork"};
		var query_url = osm_base_url + "/" + osm_stork_bucket + "/query";
		var query_requester = http_url_getter.create();
		
		console.log("Connecting to " + query_url + " to get the tracking object.");
		query_requester.get_resource(query_url, 'POST', JSON.stringify(query_obj));
		
		query_requester.on('error', function (msg) {
			console.log("Error retrieving the tracking object: " + msg);
		});
		
		query_requester.on('response', function (body) {
			var resp_objs = JSON.parse(body);
			
			if (resp_objs.objects.length === 0) {
				console.log("No tracking object in the OSM, returning new one.");
				var osm_obj = self.get_new_tracker();
			} else {
				console.log("Tracking object found, returning it.");
				var osm_doc = resp_objs.objects[0];
				var osm_obj = osm_doc.state;
			}
			self.emit('storkTracker', osm_obj);
		});	
	};
	
	client.update_tracking_obj = function (updated_tracking_obj) {
		var self = this;
		
		console.log("Posting updated Stork tracking object to the OSM.");
		
		var query_obj = {"state.joblist" : "stork"};
		var query_url = osm_base_url + "/" + osm_stork_bucket + "/query";
		var query_requester = http_url_getter.create();
		
		console.log("Connecting to " + query_url + "to get the tracking object.");
		query_requester.get_resource(query_url, 'POST', JSON.stringify(query_obj));
		
		query_requester.on('error', function (msg) {
			console.log("Error retrieving the tracking object: " + msg);
		});
		
		query_requester.on('response', function (body) {
			var resp_objs = JSON.parse(body);
			var osm_obj = updated_tracking_obj;

			if (resp_objs.objects.length === 0) {
				console.log("No tracking object found, adding a new one.");
				var update_url = osm_base_url + "/" + osm_stork_bucket;

			} else {
				console.log("Tracking object found, updating it.");
				var osm_doc = resp_objs.objects[0];
				var update_url = osm_base_url + "/" + osm_stork_bucket + "/" + osm_doc.object_persistence_uuid; 
			}
			
			console.log("Pushing updated tracking object to the OSM.")
			var tracker_updater = http_url_getter.create();
			tracker_updater.get_resource(update_url, 'POST', JSON.stringify(osm_obj));
			
			query_requester.on('error', function (msg) {
				console.log("Error updating tracking object: " + msg);
			});
			
			query_requester.on("response", function (body) {
				console.log("Response from updating tracking object:\n" + body)
			});
		});
	};
	
	return client;
};



/*
 * Creates a new OSM client.
 *
 * params:
 *   osm_base_url - the base URL used to communicate with the OSM.
 *   osm_bucket   - the bucket to use when working with the OSM.
 * returns:
 *   the new OSM client.
 */
exports.create = function(osm_base_url, osm_bucket) {
	var client = Object.create(new events.EventEmitter, {});

	/*
	 * Translates a Stork status code to the corresponding status code used
	 * in the OSM.
	 *
	 * params:
	 *   stork_status - the status code provided by Stork.
	 * returns:
	 *   the corresponding status code used in the OSM.
	 */
	var translate_job_status = function(stork_status) {
		var job_status = STATUS_TRANSLATIONS[stork_status];
		if (typeof(job_status) !== 'undefined' && job_status !== null) {
			return job_status;
		}
		return STATUS_TRANSLATIONS['default'];
	}

	/*
	 * Stores the updated job status in the OSM.
	 *
	 * params:
	 *	 self		  - the OSM client.
	 *	 stork_status - the status record provided by Stork.
	 *	 osm_record	  - the status record obtained from the OSM.
	 */
	var store_updated_job_status = function(self, stork_status, osm_record) {
		var osm_uuid = osm_record.object_persistence_uuid;
		var dag_node = stork_status.dag_node;
		var osm_state = osm_record.state;
		var job_status = translate_job_status(stork_status.status);
        console.log("Job status is " + job_status + " for DAG node " + dag_node);

		if (osm_state.jobs[dag_node] !== undefined) {
			var osm_status = osm_state.jobs[dag_node].status;
			
			//Only push the state to the OSM if it's different from the current state.
			if (osm_status !== job_status) {
				if (job_status === "Failed") {
					osm_state.status = "Failed";
				}

				//If the job is failed or completed in the OSM, then don't update it.
				//Avoids spurious updates to the OSM, which causes the history of an
				//object to expand a bunch.
				if ((osm_status !== 'Completed') && (osm_status !== 'Failed')) {			  
					osm_state.jobs[dag_node].status = job_status;
			
					var update_url = osm_base_url + '/' + osm_bucket + '/' + osm_uuid;
					var updater = http_url_getter.create();
			
					updater.get_resource(update_url, 'POST', JSON.stringify(osm_state));
					updater.on('error', function(err) {
						var msg = 'unable to update the job status for ' + dag_node + ': '
							+ err;
						console.log(msg);
					});
				}
			}
		}
	};

	/*
	 * Updates the job status in the OSM using the information obtained from
	 * the given status record obtained from Stork.
	 *
	 * params:
	 *   stork_status: the status record obtained from Stork.
	 */
	client.update_job_status = function(stork_status) {
		var self = this;
		var request_url = osm_base_url + '/' + osm_bucket + '/query';
		console.log(stork_status.uuid);
		var request_body = '{"state.uuid": "' + stork_status.uuid + '"}';
		var searcher = http_url_getter.create();
		searcher.get_resource(request_url, 'POST', request_body);
		searcher.on('error', function(err) {
			console.log('unable to get the job status: ' + err);
		});
		searcher.on('response', function(body) {
			try {
				var result = JSON.parse(body);
				if (result.objects.length > 0) {
					var osm_record = result.objects[0];
					store_updated_job_status(self, stork_status, osm_record);
				}
			}
			catch (err) {
				console.log('unable to update the job status: ' + err);
				console.log(err.stack);
			}
		});
	};
	
	client.get_analysis_doc = function (uuid, callback) {
        var self = this;
        var request_url = osm_base_url + "/" + osm_bucket + "/query";
        var request = '{"state.uuid" : "' + uuid + '"}';
        var searcher = http_url_getter.create();
        
        searcher.get_resource(request_url, 'POST', request);
        
        searcher.on('error', function (err) {
            console.log('Unable to get the job status: ' + err);
        });
        
        searcher.on('response', function (body) {
            try {
                var result = JSON.parse(body);
                if (result.objects.length > 0) {
                    var osm_record = result.objects[0];
                    callback(osm_record);
                }
            } catch (err) {
                console.log("Unable to get the analysis doc from the OSM: " + err);
                console.log(err.stack);
                responded = true;
            }
        });
    };
    
    client.set_analysis_doc = function (doc) {
        var self = this;
        var request_url = osm_base_url + "/" + osm_bucket + "/" + doc.object_persistence_uuid;
        var request = JSON.stringify(doc.state);
        var searcher = http_url_getter.create();
        
        searcher.get_resource(request_url, 'POST', request);
        
        searcher.on('error', function (err) {
            console.log("Unable to get the job status: " + err);
        });
        
        searcher.on('response', function (body) {
            try {
                console.log("Received a response from the OSM for object " + doc.object_persistence_uuid);
                
            } catch (err) {
                console.log("Unable to get the analysis doc from the OSM: " + err);
                console.log(err.stack);
            }
        });
     };

	return client;
}
