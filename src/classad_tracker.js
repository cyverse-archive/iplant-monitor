const
    events = require('events'),
    analysis_states = require('./analysis_states'),
    _ = require('./underscore');
    
var create_classad_tracker = function () {
    var tracker = Object.create(new events.EventEmitter, {});
    tracker.current_states = {};
    
    tracker.get_analysis_by_uuid = function (uuid) {
        return this.current_states[uuid];
    };
    
    var get_analysis_from_classad = function (classad) {
        var self = this;
        
        var uuid = classad.IpcUuid;
        var user = classad.IpcUsername;
        
        if (!tracker.current_states.hasOwnProperty(uuid)) {
            tracker.current_states[uuid] = {
                'uuid' : uuid,
                'user' : user,
                'status' : '',
                'jobs' : {}
            };
        }
        
        return tracker.current_states[uuid];
    };
    
    var create_job_from_classad = function (classad) {
        var job_obj = {};

        job_obj.status = analysis_states.JOB_STATUS[classad.JobStatus];
        job_obj.remove_reason = "";
        job_obj.exit_status = "";
        job_obj.exit_code = "";
        job_obj.exit_by_signal = false;
        job_obj.exit_signal = "";

        if (classad.hasOwnProperty('ClusterId')) {
            job_obj.job_id = classad.ClusterId;
        }

        if (classad.hasOwnProperty('RemoveReason')) {
            job_obj.remove_reason = classad.RemoveReason;
        }

        if (classad.hasOwnProperty('ExitStatus')) {
            job_obj.exit_status = classad.ExitStatus;
        }

        if (classad.hasOwnProperty('ExitCode')) {
            job_obj.exit_code = classad.ExitCode;
        }

        if (classad.hasOwnProperty('ExitBySignal')) {
            if (classad.ExitBySignal === "TRUE") {
                job_obj.exit_by_signal = true;
            } else {
                job_obj.exit_by_signal = false;
            }
        }

        if (classad.hasOwnProperty('ExitSignal')) {
            job_obj.exit_signal = classad.ExitSignal;
        }
        
        return job_obj;
    }
    
    tracker.each = function (iterator_func) {
        var self = this;
        _.each(self.current_states, iterator_func);
        console.log("emitting eachDone");
        self.emit('eachDone');
    };
    
    tracker.add_classad = function (cl) {
        var self = this;
        
        //Other non-DE jobs may be in the system.
        if (cl.hasOwnProperty("IpcUuid")) {
            var analysis = get_analysis_from_classad(cl);

            if (!analysis.jobs.hasOwnProperty(cl.IpcJobId)) {
                analysis.jobs[cl.IpcJobId] = {};
            }

            analysis.jobs[cl.IpcJobId] = create_job_from_classad(cl);
        }
    };
    
    return tracker;
};

exports.create_classad_tracker = create_classad_tracker;
