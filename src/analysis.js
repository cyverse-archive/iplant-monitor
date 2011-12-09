const
    events = require('events'),
    analysis_states = require('./analysis_states');

var create_analysis = function (analysis_state, object_id) { 
    var analysis = analysis_state;
    
    analysis.update_osm_job = function (classad_analysis) {
        var self = this;

        for (job in classad_analysis.jobs) {
            var classad_analysis_job = classad_analysis.jobs[job];

            if (self.hasOwnProperty("jobs")) {
                if (self.jobs.hasOwnProperty(job)) {
                    var osm_job = self.jobs[job];

                    for (var field in classad_analysis_job) {
                        osm_job[field] = classad_analysis_job[field];
                    }
                }
            }
        }
        return self;
    };
    
    var job_failed = function (job_obj) {
        var handle_completed = function (job_obj) {
            var retval = false;

            if (job_obj.exit_by_signal) {
                retval = true;
            } else {
                if (job_obj.exit_code !== "0") {
                    retval = true;
                }
            }

            return retval;
        };

        var retval = {'failed' : false, 'held' : false};

        switch (job_obj.status) {
            case analysis_states.COMPLETED:
                if (job_obj.type === "condor") {
                    retval['failed'] = handle_completed(job_obj);
                } else {
                    retval['failed'] = false;
                }
                break;
            case analysis_states.REMOVED:
                retval['failed'] = true;
                break;
            case analysis_states.HELD:
                retval['failed'] = true;
                retval['held'] = true;
                break;
            case analysis_states.SUBERR:  
                retval['failed'] = true;
                break;
            case analysis_states.SUBMITTED:
                retval['failed'] = false;
                break;
            case analysis_states.UNEXPANDED:
                retval['failed'] = false;
                break;
            case analysis_states.IDLE:
                retval['failed'] = false;
                break;
            case analysis_states.RUNNING:
                retval['failed'] = false;
                break;
            case analysis_states.UNEXPANDED:
                retval['failed'] = false;
                break;
            default:
                retval['failed'] = true;
                break;
        }

        return retval;
    };
    
    var analysis_failed = function () {
        var jobs = analysis.jobs,
            failed = false,
            held = false;
        
        for (var jobkey in jobs) {
            var job = jobs[jobkey];
           
            if (job.status === "Failed") {
                failed = true;
            } else { 
                var fail_state = job_failed(job);
                
                if (fail_state['failed']) {
                    console.log("Analysis: " + analysis.uuid + "\tJob: " + jobkey + "\tFailed: True");
                    failed = true;
                }
                
                if (fail_state['held']) {
                    console.log("Analysis: " + analysis.uuid + "\tJob: " + jobkey + "\tHeld: True");
                    held = true;
                }
            }
        }
        
        analysis['held'] = held;
        
        return failed;
    };
    
    var analysis_submitted = function () {
        var jobs = analysis.jobs,
            submitted = true;
        
        for (var jobkey in jobs) {
            var job = jobs[jobkey];
            
            if (job.status !== analysis_states.SUBMITTED) {
                submitted = false;
            }
        }
        
        return submitted;
    };
    
    var analysis_completed = function () {
        var jobs = analysis.jobs,
            completed = true;
        
        for (var jobkey in jobs) {
            var job = jobs[jobkey];

            if (job.status !== analysis_states.COMPLETED) {
                completed = false;
            }
        }

        return completed;
    };
    
    var analysis_running = function () {
        //If none of the jobs are running or 
        //failed and one of the jobs is idle, 
        //then the analysis is idle.
        var jobs = analysis.jobs,
            running = false;
        
        for (var jobkey in jobs) {
            var job = jobs[jobkey];

            if (job.status === analysis_states.RUNNING) {
                running = true;
            }
        }

        return running;
        
    };
    
    analysis.set_analysis_status = function () {
        var jobs = analysis.jobs;
        var state = analysis_states.IDLE;
        
        if (analysis_failed()) {
            state = analysis_states.FAILED;
        } else {
            if (analysis_completed()) {
                state = analysis_states.COMPLETED;
            } else {
                if (analysis_submitted()) {
                    state = analysis_states.SUBMITTED;
                } else {
                    if (analysis_running()) {
                        state = analysis_states.RUNNING;
                    }
                 }
            }
        }
        analysis.status = state;
    };
    
    return analysis;
};

exports.create_analysis = create_analysis;
