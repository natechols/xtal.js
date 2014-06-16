/* 
	PHENIX module for reading and writing mmCIF files.
*/

var phenix = (function(module) {return module})(phenix||{});
phenix.mmcif = (function(module) {

  // Regular expressions for matching commands
	// and data types.
  var re_statement = /^\s*(data)?(loop)?(_[\.\w]+)?(save_)?/;
  var re_tag = /^\s*([^\s]+)\s+(.*)/;
  var re_block = /data_(\w+)/;
  var re_float = /^[+-]?(\d+)?(\.\d+)?$/;
	var re_whitespace = /\s/;

  function checknumber(v) {
		/* Try to coerce a string into a Number */
  	if (re_float.test(v)) {
  		return Number(v);
  	}
  	return v
  }
	
	function trim(key) {
		return key.trim().toLowerCase();
	}

  /*********************************************/
	function input_generator(buffer, sep) {
		/* Input generator */
		// Would be nice if ECMAScript 6 iterators were widely available.
    this.buffer = buffer || "";
    this.sep = sep || "\n";
    this.i = 0;
    this.j = this.buffer.indexOf(this.sep, this.i);
    this.end = this.buffer.lastIndexOf(this.sep);
	}
	input_generator.prototype.add = function(input) {
		this.buffer = this.remainder() + input;
		this.i = 0;
    this.j = this.buffer.indexOf(this.sep, this.i);
    this.end = this.buffer.lastIndexOf(this.sep);
	}
	input_generator.prototype.next = function() {
    if (this.j == -1) {return null}
    var line = this.buffer.substring(this.i, this.j);
    this.i = this.j + 1;
    this.j = this.buffer.indexOf(this.sep, this.i);
    return line
	}
	input_generator.prototype.remainder = function() {
		return this.buffer.substring(this.i, this.end);
	}
  
  /*********************************************/
  function phenix_mmcif_reader() {
    /* mmCIF Reader */
		// A dictionary of blocks.
    this.blocks = {};
  }
  phenix_mmcif_reader.prototype.add_block = function(block) {
    this.blocks[block.name] = block;
  }
  phenix_mmcif_reader.prototype.get_block = function(name) {
    return this.blocks[trim(name)];
  }
  phenix_mmcif_reader.prototype.load = function(url, callback) {
    /* Load data */
    // Create a new parser.
  	var self = this;
  	var parser = new phenix_mmcif_parser(function(b){self.add_block(b)});
  	function listen(e) {
			parser.parse_chunk(this.response);
      callback(self);
  	}
    // Request file.
  	var req = new XMLHttpRequest();
  	req.open("GET", url, true);
		// req.onprogress is supported for streaming 
		//	if responseType = 'moz-chunked-text', but this 
		//	is a Firefox only extension.
		// req.onload will fire when the response is complete.
  	req.onload = listen;
  	req.send();
  }

  /*********************************************/
  function phenix_mmcif_block(name) {
    /* mmCIF Data Block */
    this.name = trim(name);
    this.data = {};
  }
  phenix_mmcif_block.prototype.get = function(key) {
		/* Get a mmCIF value for key */
    return this.data[key]
  }
  phenix_mmcif_block.prototype.transpose = function(key) {
		/* Transpose a loop */
    var group = {};
    for (var i in this.data) {
      if (i.indexOf(key)==0) {
        group[i] = this.data[i];
      }
    }
    return group    
  }
  phenix_mmcif_block.prototype.group = function(key) {
		/* Return subset of keys with a common prefix key */
    var group = {};
    for (var i in this.data) {
      if (i.indexOf(key)==0) {
        group[i] = this.data[i];
      }
    }
    return group
  }
  phenix_mmcif_block.prototype.set = function(key, value) {
		/* Set a mmCIF key */
  	this.data[trim(key)] = value;
  }
	phenix_mmcif_block.prototype.append = function(key, value) {
		this.data[key].push(value);
	}
  phenix_mmcif_block.prototype.append_row = function(keys, values) {
		/* Add a row to a loop. keys and values must be same length. */
  	if (keys.length != values.length) {
  		return
  	}
  	for (var i=0;i<keys.length;i++) {
  		this.data[keys[i]].push(values[i]);
  	}
  }
  phenix_mmcif_block.prototype.add_loop_key = function(key) {
		/* Initialize a key in a loop */
  	this.data[key] = [];
  }

  /*********************************************/
  function phenix_mmcif_parser(block_callback) {
  	/* mmCIF Parser
	
  	Processes a stream of mmCIF statements. Each statement can update the 
		state, and/or return a function for handling the next line of input.
		(TODO: better explanation.)
	
  	I may add support for events, where listeners may subscribe to changes
  	in the CIF model as they are parsed.
	
  	*/
    // The input buffer line generator.
  	this.gen = new input_generator("");
    // The new block callback
    this.block_callback = block_callback || function(block) {};
    // The current mmCIF Block
  	this.block = null;
    // The current loop keys
  	this.loop = null;
		this.loop_i = 0;
    // The current step
  	this.step = this.step_init; 
  }
  phenix_mmcif_parser.prototype.parse_chunk = function(input) {
  	// Process the lines in the input data.
		this.gen.add(input);
		var line = this.gen.next();
		while (line != null) {
			this.step = this.step(line);
			line = this.gen.next();
		}
  }
  /***** Steps *****/
  phenix_mmcif_parser.prototype.step_init = function(line) {
  	// Initial step, or after returning from a loop or block.
  	var m = re_statement.exec(line);
  	if (m[1]) {
  		// Start a block.
  		return this.step_block(line)
  	} else if (m[2]) {
  		// Start a loop.
  		return this.step_loop(line)
  	} else if (m[3]) {
  		// Start a tag.
  		return this.step_tag(line)
  	}
  	// Default:
  	// Next step: stay in initial state.
  	return this.step_init
  }
  phenix_mmcif_parser.prototype.step_block = function(line) {
    // Create a new block. 
  	var name = re_block.exec(line)[1];
    this.block = new phenix_mmcif_block(name);
    // Call block_callback whenever a block is created.
    this.block_callback(this.block);
  	// Next step: step_block is always a single line command
  	return this.step_init
  }
  phenix_mmcif_parser.prototype.step_loop = function(line) {
  	// Initialize the loop
  	this.loop = [];
		this.loop_i = 0;
  	// Next step: add loop keys.
  	return this.step_loop_keys
  }
  phenix_mmcif_parser.prototype.step_loop_keys = function(line) {
  	var m = re_statement.exec(line);
  	if (m[3]) {
  		// Add the key to the loop.
      var key = trim(m[3]);
      this.loop.push(key);
      // Initialize the array in the block.
  		this.block.add_loop_key(key);
  		// Next step: stay in loop keys.
  		return this.step_loop_keys;
  	} else {
			// No more keys...
  		// Next step: start appending loop data.
  		return this.step_loop_append(line);
  	}
  }
  phenix_mmcif_parser.prototype.step_loop_append = function(line) {
  	var m = re_statement.exec(line);
  	if (m[0]) {
  		// Next step: a statement was found, return to initial step.
  		return this.step_init(line)
  	}
		var values = this.parse_values(line);
		var loop_length = this.loop.length;
		for (var i=0; i<values.length; i++) {
			this.block.append(this.loop[this.loop_i % loop_length], values[i]);
			this.loop_i += 1;
		}
  	return this.step_loop_append
  }
  phenix_mmcif_parser.prototype.step_tag = function(line) {
  	var m = re_tag.exec(line);
  	if (!m[0]) {
  		// Next step: Return to init
  		return this.step_init(line)
  	}
  	// Set the current tag
  	var tag = m[1];
  	var value = this.parse_values(m[2]);
		// if (m[2] == "") {
		// 	// Next step: multi-line tag text
		// 	console.log("multiline?", m[2]);
		// 	value = this.parse_values(this.gen.next());
		// 	// return this.step_tag_text
		// }
  	this.block.set(tag, value[0]);
  	return this.step_init
  }
  phenix_mmcif_parser.prototype.step_save = function(line) {
		var m = re_statement.exec(line);
		if (m[4]) {
			// Next step: found end save_; break
			return this.step_init
		}
  	return this.step_save
  }
  phenix_mmcif_parser.prototype.parse_values = function(line) {
    /* Process a string containing values.
    These may or may not be quoted with single or double quotes.
  
    Example:
      abc "with space" -1.2 +4.5 
      -> 
      ["abc", "with space", -1.2, 4.5]
    1. Find the first quote or non-whitespace character
    2. If quoted, copy until next quote.
    3. If not quoted, copy until next whitespace.
    4. Skip to end of value. Repeat until end of line.
    */
  	var p = []; // return values
  	var char = null;  // current character
  	var i = 0; // current index
  	var j = line.length; // end index

		if (line[0] == ";") {
			return [this.parse_value_text(line.substring(1, j))]
		}

  	while (i < (j-1)) {
  		char = line[i];
  		if (re_whitespace.test(char)) {
  			// unquoted leading whitespace; skip to next char.
  			i++;
			} else if (char == "#") {
				// Unquoted hash -- rest of line is a comment; return
				i = j;
  		} else if (char == '"' || char == "'") {
  			// append value between quotes
  			n = line.indexOf(char, i+1); // find next quote after quote
  			if (n<1){n=j} // ...until end of line if not found
  			p.push(checknumber(line.substring(i+1, n))); // find string between
  			i = n + 1; // advance past end quote
  		} else {
  			// append until next whitespace
  			n = line.indexOf(" ", i+1);
  			if (n<1){n=j}
  			var test = checknumber(line.substring(i, n));
  			p.push(test);
  			i = n; // advance past next whitespace
  		}
  	}
  	return p
  }
	phenix_mmcif_parser.prototype.parse_value_text = function(line) {
		var text = "";
		// Feed forward multi-line text comments...
		while (line != null) {
			text += line;
			//text += " ";
			line = this.gen.next();
			// until we find a solitary ";"
			if (line == ";") {
				break
			}
		}
		return text
	}
	
	
	
  // Export into phenix.mmcif
  return {
    'parser':phenix_mmcif_parser,
    'block':phenix_mmcif_block,
    'reader':phenix_mmcif_reader
  }
})(phenix);