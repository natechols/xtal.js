/* 

xtal.js mmCIF Viewer.

Exports:
	CIFExplorer

*/
var xtal = (function(module) {return module})(xtal||{});
xtal.cifexplorer = (function(module) {

	function CIFExplorer(elem, options) {
		// CIF Explorer
		this.elem = elem;
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
		this.elem.empty();
		for (var block in model.blocks) {
			this.init_block(model.blocks[block]);
		}
	}
	CIFExplorer.prototype.init_block = function(cif_block) {
		// Initialize a CIF block
		var block = $('<div />');
		var ul = $('<ul />').appendTo(block);
		var groups = cif_block.groups().sort();
		for (var i in groups) {
			this.draw_group(block, ul, cif_block, groups[i])
		}
		block.tabs().addClass('ui-tabs-vertical ui-helper-clearfix');
		this.elem.append(block);
	}
	CIFExplorer.prototype.draw_group = function(block, ul, cif_block, group_key) {
		// Draw a CIF category / group
		var fragment = block.name+"."+group_key;
		fragment = fragment.replace(".", "_");

		// Add the tab
		var li = $('<li />')
		var a = $('<a />', {
			href: '#'+fragment,
			text: group_key
		})
		.appendTo(li);
		ul.append(li);
		
		// Add the box
		var box = $('<div />', {id: fragment}).appendTo(block);		
		$('<h1>').text(group_key).appendTo(box);
		
		var group_keys = cif_block.group_keys(group_key).sort();
		console.log(group_keys);

		var items = $('<ul />').appendTo(box);
		for (var i in group_keys) {
			var li = $('<li />')
			.text(group_keys[i])
			.appendTo(items)
		}
		
	}
  // Exports
  return {
		'CIFExplorer':CIFExplorer
  }
})(xtal);