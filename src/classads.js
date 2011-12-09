const
    events = require('events');
     
var string_trim = function (string) {
    return string.replace(/^\s*/, "").replace(/\s*$/, "");
};

var trim_quotes = function (string) {
    return string.replace(/^\"/, '').replace(/\"/, '');
};

var create_parser = function () {
    var parser = Object.create(new events.EventEmitter, {});
    
    parser.in_stream = null;
    
    parser.parse = function (classads_string) {
        var self = this;
        var classads = classads_string
            .replace(/^\s*/, "")    //trim leading spaces
            .replace(/\s*$/, "")    //trim trailing spaces
            .split("\n\n");         //split on blank lines

        classads.forEach(function (classad) {
            var retval = {};
            
            var lines = classad.split('\n') //split on newlines.
                .filter(function(line) {return line !== '';})
                .filter(function(line) {return line.match(/^[a-zA-Z\_]/)}); 
                
            for (var i = 0; i < lines.length; i++) {
                //The values may include = signs and we don't want to
                //split on those, so limit the length of the array.
                var entries = lines[i].split("=");
                var key = trim_quotes(string_trim(entries[0]));
                var value = trim_quotes(string_trim(entries.slice(1).join("=")));
                retval[key] = value;
            }
            
            self.emit('classad', retval);
        });
        
        return self;
    };

    parser.lines = [];

    parser.process_line = function (aline) {
        parser.lines.push(aline);

        if (aline === "") {
            console.log(parser.lines.join("\n"));
            parser.parse(parser.lines.join("\n"));
            parser.lines = [];
        }
    };
    
    parser.process_stream = function (in_stream) {
        var self = this;
        var data = "";
        
        self.in_stream = in_stream;
        
        self.in_stream.on('data', function (chunk) {
            data += chunk.toString();
        });

        //    var end_ad_loc = data.indexOf("\n");
        //
        //    if (end_ad_loc !== -1) {
        //        parser.process_line(data.slice(0, end_ad_loc + 1));
        //        data = data.slice(end_ad_loc + 1)
        //    }
        //});
        
        self.in_stream.on('end', function () {
            var alllines = data.split("\n");

            alllines.forEach(function(aline){
                if (aline !== "") {
                    parser.lines.push(aline);
                } else {
                    parser.parse(parser.lines.join("\n"));
                    parser.lines = [];
                }
            });

            self.emit('end');
        });
        
        return self;
    };
    
    return parser;
};

exports.create_parser = create_parser;
