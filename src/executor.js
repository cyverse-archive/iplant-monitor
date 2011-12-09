const
    fs = require('fs'),
    events = require('events'),
    path = require('path'),
    sys = require('sys'),
    daemon = require('daemon.node'),
    exec = require('child_process').exec,
    spawn = require('child_process').spawn;
    
var get_new_console_logger = function() {
    return function(msg) {
        var now = new Date();
        process.stdout.write(msg + "\n");
    };
};

var file_exists = function(path) {
    var path_exists = true;
    try {
        var test_path = fs.realpathSync(path);
    } catch (err) {
        path_exists = false;
    }
    return path_exists;
};

//The fs.mkdir() function in node.js doesn't have a way to specify the -p option,
//so I hacked together this simplistic implementation.
var mkdir_p = function (dirpath, mode) {
    var dirnames = dirpath.split('/');
    var dir_index = 0;

    var dir_list = [];
    for (var i = 0; i < dirnames.length; i++) {
        dir_list.push(dirnames[i]);

        var this_path = dir_list.join('/');
        if (!file_exists(this_path)) {
            fs.mkdirSync(this_path, mode);
        }
    }
};

console.log = get_new_console_logger();

//Node.js's exec() is not useful to us here and I'm not rewriting a ton a code.
var useful_exec = function (command_to_run, args, callback) {
    var mychild = spawn(command_to_run, args);
    var stderr_data = "";
    var stdout_data = "";

    mychild.stdout.on('data', function (chunk) {
        console.log(chunk.toString());
    });

    mychild.stderr.on('data', function (chunk) {
        console.log(chunk.toString());
    });

    mychild.on('exit', function (code) {
        var ret_code = code;
        if (code === 0) {
            ret_code = null;
        }

        callback(ret_code);
    });
};

var service = function () {
    var executor = Object.create(new events.EventEmitter, {});
    
    const POS_PID = 3;
    const POS_CONF = 2;
    
    var config_file = "";
    config_file = fs.realpathSync(process.argv[POS_CONF]);
    config = JSON.parse(fs.readFileSync(config_file));
    var outputfs = null;
    
    var print_usage = function() {
        sys.puts("node executor.js <conf-file> <pid-file>");
    };
    
    executor.condor_history_callback = function (err) {
        var self = this;
        
        if (err !== null) {
            console.log("Error returned from condor_history exec: " + err);
        }
        
        executor.emit('condorHistoryDone');
    };

    executor.condor_q_callback = function (err) {
        var self = this;
        
        if (err !== null) {
            console.log("Error returned from condor_q exec: " + err);
        }
        
        executor.emit("condorQDone")
    };
    
    executor.on("condorHistoryDone", function () {
        useful_exec(config.node_path, [config.condormonitor_path, config.condor_q_conf], executor.condor_q_callback);
    });
    
    executor.on("condorQDone", function () {
        useful_exec(config.node_path, [config.condormonitor_path, config.condor_history_conf], executor.condor_history_callback);
    });
    
    var get_logging_stream = function () {
        return fs.createWriteStream(config.logfile, {'flags' : 'a'});
    };
    
    var setup_logging = function () {
        var self = this;
        self.outputfs = get_logging_stream();

        console.log = function(msg) {
            var now = new Date();
            self.outputfs.write(msg + "\n");
        };
    };

    var get_log_stream = function () {
        return this.outputfs;
    };
    
    return {
        start : function () {
	    setup_logging();
            if (path.existsSync(config.daemon_lockfile)) {
                sys.debug("Lock file " + config.daemon_lockfile + " exists. Is the service already running?");
                process.exit(1);    
            }
            
            // Output pid file
	    fs.writeFile(process.argv[POS_PID], process.pid + "", function(err) {
		if(err) {
		    sys.puts(err);
		    sys.exit(1);
		}
	    });

            useful_exec(config.node_path, [config.condormonitor_path, config.condor_q_conf], executor.condor_q_callback);
        },

        restart_log : function () {
            var log_stream = get_log_stream();
            log_stream.end();
            setup_logging();
        }
    };
}();

process.on('SIGUSR1', function () {
    service.restart_log();
});

process.on('SIGTERM', function () {
    console.log("SIGTERM signal received, stopping.");
    process.exit(1);
});

process.on('SIGINT', function() {
    console.log("SIGINT signal received, stopping.");
    process.exit(1);
});

process.on('SIGQUIT', function() {
    console.log("SIGQUIT signal received, stopping.");
    process.exit(1);
})

service.start();
