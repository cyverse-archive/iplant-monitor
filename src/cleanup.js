const
    path = require('path'),
    url = require('url'),
    fs = require('fs'),
    spawn = require('child_process').spawn;

var clean_username = function (username) {
    return username.replace("/@/g", "_");
};

var transfer_files = function (analysis, nfs_dir, iput_path, imkdir_path) {
    console.log("Transferring files...");
    var uuid = analysis.uuid;
    var username = clean_username(analysis.user);;
    var remote_dir = url.parse(analysis.output_dir).pathname;
    var dir_name = path.basename(remote_dir);
    var nfs_dir = path.join(nfs_dir, username, dir_name);

    console.log("transferring to " + remote_dir);
    console.log("transferring from " + nfs_dir);

    console.log(JSON.stringify(process.env, null, "\t"));
    
    path.exists(nfs_dir, function (nfs_dir_exists) {
        if (nfs_dir_exists) {
            var imkdir = spawn(imkdir_path, ["-p", remote_dir]);

            imkdir.stdout.on('data', function (chunk) {
                console.log(chunk.toString());
            });

            imkdir.stderr.on('data', function (chunk) {
                console.log(chunk.toString());
            });

            imkdir.on('exit', function (code) {
                console.log("imkdir -p " + remote_dir + " exited with code " + code);

                if (code === 0 ) {
                    var irsync_path = path.join(path.dirname(iput_path), "irsync");
                    var irsync = spawn(irsync_path, ['-rv', nfs_dir, "i:" + remote_dir]);
                    
                    irsync.stdout.on('data', function (chunk) {
                        console.log(chunk.toString());
                    });
                    
                    irsync.stderr.on('data', function (chunk) {
                        console.log(chunk.toString());
                    });
                    
                    irsync.on('exit', function (code) {
                        console.log("irsync -rv " + nfs_dir + " i:" + remote_dir);
                    });
                }
            });
        } else {
            console.log("DIRECTORY " + nfs_dir + "DOES NOT EXIST.");
        }
    });
};

var cleanup_held_dag = function (analysis) {
    var dag_id = analysis.dag_id;
    var condor_rm = spawn("condor_rm", [dag_id]);
    var output = "";
    
    if ((dag_id !== null) && (dag_id !== undefined)) {
        console.log("Attempting to run condor_rm " + dag_id + " for analysis " + analysis.uuid);
    
        condor_rm.stdout.on('data', function (chunk) {
            output += chunk.toString();
        });
    
        condor_rm.stderr.on('data', function (chunk) {
            output += chunk.toString();
        });
    
        condor_rm.on('exit', function (code) {
            console.log(output);
            console.log('condor_rm exited with code ' + code);

            for (var jkey in analysis.jobs) {
                var j = analysis.jobs[jkey];

                var job_rm = spawn("condor_rm", [j.job_id]);

                job_rm.stdout.on('data', function (chunk) {
                    output += chunk.toString();
                });

                job_rm.stderr.on('data', function (chunk) {
                    output += chunk.toString();
                });
            }
        });
    }
};

var cleanup_directories = function(analysis, local_dir_base, nfs_dir) {
    var uuid = analysis.uuid;
    var username = clean_username(analysis.user);
    var dir_name = username + "-" + uuid;
    
    var log_dir = path.join(local_dir_base, dir_name);
    var nfs_dir = path.join(nfs_dir, dir_name);
    
    path.exists(log_dir, function (log_dir_exists) {
        if (log_dir_exists) {
            path.exists(nfs_dir, function (nfs_dir_exists) {
                if (!nfs_dir_exists) {
                    console.log("NFS directory " + nfs_dir + " doesn't exist, can't copy anything.");
                } else {
                    console.log("Rsyncing " + log_dir + " to " + nfs_dir);
                    var copy = spawn("rsync", ["-avz", log_dir + "/", nfs_dir + "/"]);
            
                    copy.stdout.on('data', function (chunk) {
                        console.log(chunk.toString());
                    });
            
                    copy.stderr.on('data', function (chunk) {
                        console.log(chunk.toString());
                    });
            
                    copy.on('exit', function (code) {
                        console.log("rsync exited with " + code);
                        console.log("Done attempting to rsync " + log_dir + " to " + nfs_dir + ".");
                
                        if (code === 0) {
                            console.log("Removing " + log_dir + ".");
                            var rm = spawn("rm", ["-rf", log_dir + "/"]);
                    
                            rm.stdout.on('data', function (chunk) {
                                console.log(chunk.toString());
                            });
                    
                            rm.stderr.on('data', function (chunk) {
                                console.log(chunk.toString());
                            });
                    
                            rm.on('exit', function (code) {
                                console.log("rm exited with code " + code);
                                console.log("Done attempting to remove " + log_dir + ".");
                            });
                        }
                    });
                };
            });
        } else {
            console.log("Log directory " + log_dir + " doesn't exist, can't copy anything.");
        }
    });
};

exports.cleanup_held_dag = cleanup_held_dag;
exports.cleanup_directories = cleanup_directories;
exports.transfer_files = transfer_files;
