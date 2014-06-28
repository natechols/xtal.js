/* 

xtal.js mmCIF Viewer.

Exports:
	CIFExplorer

*/
var xtal = (function(module) {return module})(xtal||{});
xtal.cifexplorer = (function(module) {

	function CIFExplorer(elem, options) {
		// CIF Explorer
		this.element = elem;
		this.element_ul = null;
		this.options = options || {};
	}
	CIFExplorer.prototype.load = function(url) {
		// Load a CIF model
		var self = this;
		var reader = new xtal.cif.Reader();
		reader.load(url, function(model){self.load_cb(model)});
	}
	CIFExplorer.prototype.load_cb = function(model) {
		// Callback for loaded model
		this.element.empty();
		this.element_ul = $('<ul />').appendTo(this.element);
		var testblocks = {};
		this.draw_blocks(model.blocks);
	}
	CIFExplorer.prototype.draw_blocks = function(blocks) {
		// Get all groups in all blocks
		var allgroups = {};
		for (var block in blocks) {
			blocks[block].groups().map(function(key) {
				allgroups[key] = true;
			})
		}
		allgroups = Object.keys(allgroups).sort();
		// Draw each group
		var self = this;
		allgroups.map(function(group) {
			self.draw_group(blocks, group)
		});
		this.element.tabs().addClass('ui-tabs-vertical ui-helper-clearfix');
	}
	CIFExplorer.prototype.draw_group = function(blocks, group_key) {
		// Draw a CIF category / group
		var fragment = group_key.replace(".", "_");

		// Add the tab
		var li = $('<li />')
		var a = $('<a />', {
			href: '#'+fragment,
			text: group_key
		})
		.appendTo(li);
		this.element_ul.append(li);
		
		// Add the box
		var box = $('<div />', {id: fragment}).appendTo(this.element);		
		$('<h1>').text(group_key).appendTo(box);
		
		// Gather all keys in all blocks
		var group_keys = {};
		for (var block in blocks) {
			blocks[block].group_keys(group_key).map(function(key) {
				group_keys[key] = true;
			})			
		}
		group_keys = Object.keys(group_keys).sort();
		
		this.draw_items(blocks, group_keys, box)
	}
	CIFExplorer.prototype.loopy = function(blocks, keys) {
		// Process everything into a loop to simplify.
		var looped_groups = [];
		for (var block in blocks) {
			var looped = {};
			var b = blocks[block];
			keys.map(function(key) {
				var value = b.get(key);
				if ($.isArray(value)) {
					looped[key] = value;
				} else {
					looped[key] = [value];
				}
			});
			looped_groups[block] = looped;
		}
		return looped_groups
	}
	CIFExplorer.prototype.draw_items = function(blocks, keys, box) {
		// Convert all block data items to loops.
		var blocks_looped = this.loopy(blocks, keys);
		var bk = [];
		var ba = [];
		for (var block in blocks_looped) {
			bk.push(block);
			ba.push(blocks_looped[block]);
		}
		console.log(bk, ba);
		// Now draw a table, with a value column for each CIF block.
		var table = $('<table />').addClass('xtal-cif-table').appendTo(box);
		var thead = $('<thead />').wrap('<tr />').appendTo(table);
		$('<th />').text('Row').appendTo(thead);
		$('<th />').text('Key').appendTo(thead);
		bk.map(function(key){
			$('<th />').text(block).appendTo(thead);			
		});
		
		// Count the max number of rows we'll need...
		// use the first key, hope for best.
		var maxrows = ba.map(function(b) {return b[keys[0]].length});
		var maxrows = Math.max.apply(null, maxrows);
		// maxrows = max(maxrows);
		var overflow = false;
		var showrows = maxrows;
		if (maxrows > 10) { 
			showrows = 10;
			overflow = true;
		}
		console.log(maxrows);

		// Draw the table.
		for (var i=0; i<showrows;i++) {
			var tbody = $('<tbody />').appendTo(table);
			for (var k in keys) {
				var row = $('<tr />').appendTo(tbody);
				// Add row group
				if (k==0) {
					$('<td />').text(i+1).attr('rowspan', keys.length).addClass('xtal-cif-tablegroup').appendTo(row);
				}
				$('<td />').text(keys[k].split(".")[1]).appendTo(row);
				// For each cif block, add a column.
				
				ba.map(function(b) {
					$('<td />').text(b[keys[k]][i]).appendTo(row);
				});
			}			
		}
		if (overflow) {
			$('<tbody><tr><td /><td>Displaying 10 of '+maxrows+' rows. Click here to view complete table.</td></tr></tbody>').appendTo(table);
		}
	}
	// CIFExplorer.prototype.draw_loops_table = function(cif_block, box, keys) {
	// 	// TODO: Replace this with raw createElement, it's much faster.
	// 	var table = $('<table />').addClass('xtal-cif-table').appendTo(box);
	// 	var thead = $('<thead />').wrap('<tr />').appendTo(table);
	// 	for (var k in keys) {
	// 		$('<th />').text(keys[k].split(".")[1]).appendTo(thead);
	// 	}
	// 	var rows = cif_block.get(keys[0]).length;
	// 	for (var i=0; i<rows;i++) {
	// 		var row = $('<tr />').appendTo(table);
	// 		// For each key in each row...
	// 		for (var k in keys) {
	// 			$('<td />').text(cif_block.get(keys[k])[i]).appendTo(row);
	// 		}
	// 	}
	// }

  // Exports
  return {
		'CIFExplorer':CIFExplorer
  }
})(xtal);