const
    events = require('events'),
    fs = require('fs'),
    spawn = require('child_process').spawn,
    classad_tracker = require('./classad_tracker'),
    classads = require('./classads'),
    cleanup = require('./cleanup'),
    osm = require('./osm'),
    path = require('path'),
    analysis = require('./analysis'),
    analysis_states = require('./analysis_states'),
    sys = require('sys'),
    _ = require('./underscore');

console.log = function (msg) {
    var now = new Date();
    process.stdout.write("[" + now.toString() + "] " + msg + "\n");
};

process.on('uncaughtException', function(err) {
    console.log("ERROR: Uncaught Exception:  " + err);
    if (err instanceof Error) {
        console.log(err.stack);
    }
    process.exit(1);
});


var string_trim = function (string) {
    return string.replace(/^\s*/, "").replace(/\s*$/, "");
};

var trim_quotes = function (string) {
    return string.replace(/^\"/, '').replace(/\"/, '');
};

var config_file = process.argv[2];
var config_data = fs.readFileSync(config_file);
var config = JSON.parse(config_data);

var in_stream = null;

if (config.stdin) {
    console.log("Will read ClassAds from stdin.");
    in_stream = process.openStdin();
} else {
    console.log("Will read ClassAds from condor_history.");

    process.env['CONDOR_CONFIG'] = config.condor_config;
    process.env['PATH'] = process.env['PATH'] + ":" + config.condor_path;
    process.env['irodsEnvFile'] = config.irods_env_file_path;

    console.log("Set CONDOR_CONFIG environment variable to " + process.env['CONDOR_CONFIG']);
    console.log("Set PATH environment variable to " + process.env['PATH']);
    console.log("Set irodsEnvFile to " + config.irods_env_file_path);

    var command_args = config.command_args.split(' ');
    for (var i = 0; i < command_args.length; i++) {
        command_args[i] = string_trim(command_args[i]);
    }

    var condor_history = spawn(config.command, command_args);
    console.log("------------EXECUTING CONDOR_MONITOR------------");
    console.log("Spawned " + config.command + " " + command_args.join(" "));
    in_stream = condor_history.stdout;
}

var create_service = function () {
    var svc = Object.create(new events.EventEmitter, {});

    svc.run = function () {
        var tracker = classad_tracker.create_classad_tracker();
        var parser = classads.create_parser();
        var osm_client = osm.create_osm_client(config.osm_baseurl, config.osm_request_type, config.osm_request_path, config.osm_max_connections);

        var got_analysis = function (res_code, res_data) {
            if (res_code !== 200) {
                return;
            }

            var osm_state = JSON.parse(res_data);
            var osm_analysises = osm_state.objects;

            _.each(osm_analysises, function (osm_analysis_doc) {
                //Get the analysis data created by a ClassAd for this analysis.
                var myanalysis = tracker.get_analysis_by_uuid(osm_analysis_doc.state.uuid);

                //Create an analysis object from the data returned from the OSM.
                var osm_analysis = analysis.create_analysis(osm_analysis_doc.state, osm_analysis_doc.object_persistence_uuid);
                var osm_status = osm_analysis.status;

                console.log("Got analysis " + osm_analysis.uuid + " from the OSM.");

                if ((osm_status !== analysis_states.FAILED) && (osm_status !== analysis_states.COMPLETED)) {
                    //Update the OSM analysis doc with the new values from the classad.
                    osm_analysis.update_osm_job(myanalysis);

                    //Calculate the new status that should go into the OSM.
                    osm_analysis.set_analysis_status();

                    console.log("Analysis: " + osm_analysis.uuid + "\tState: " + osm_analysis.status + "\n");
                    console.log("Analysis Held " + osm_analysis.held);

                    //Post update to the OSM.
                    osm_client.post_osm_update(osm_analysis, osm_analysis_doc.object_persistence_uuid);

                    //If the analysis is in the held state, then it's effectively dead in the water.
                    //Clean it up.
                    if (osm_analysis.held) {
                        console.log("Cleaning up held dag.");
                        console.log("Before transferring files...");
                        cleanup.cleanup_held_dag(osm_analysis);
                        cleanup.transfer_files(osm_analysis, config.nfs_dir, config.icommands_path, config.filetool_path);
                    }

                    //Look at the new status of the analysis and decide whether to clean up the NFS directory.
                    var analysis_status = osm_analysis.status;

                    if ((analysis_status === analysis_states.FAILED) || (analysis_status === analysis_states.REMOVED) ||
                        (analysis_status === analysis_states.COMPLETED) || (analysis_status === analysis_states.SUBERR) ||
                        (analysis_status === analysis_states.HELD)) {
                        console.log("Analysis " + osm_analysis.uuid + " is in state " + analysis_status + ", cleaning up.");

                        cleanup.cleanup_directories(osm_analysis, config.local_dir_base, config.nfs_dir);
                    }
                } else {
                    console.log("Analysis " + osm_analysis.uuid + " was in a finished state, so there's nothing to do.");
                }
            });
        };

        osm_client.on('analysis', got_analysis);

        var classad_analysis_iterator = function (value, key, list) {
            var analysis_obj = value;
            osm_client.lookup_analysis(analysis_obj.uuid);
        };

        parser.on('classad', tracker.add_classad);

        parser.on('end', function () {
            tracker.each(classad_analysis_iterator);
        });

        parser.process_stream(in_stream);
    };

    return svc;
}().run();
