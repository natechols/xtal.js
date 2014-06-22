
function display_grid (cif_obj, callback) {
  var dest = $("#restraints_grid");
  var comp_list = cif_obj.get_block("comp_list");
  var compounds = comp_list.loop_dict("_chem_comp");
  for (var i_code = 0; i_code < compounds.length; i_code++) {
    var code = compounds[i_code]['three_letter_code'];
    if (code == '.') {
      code = compounds[i_code]['id'];
    }
    var data_key = "comp_" + code.toLowerCase();
    console.log(data_key);
    var data_block = cif_obj.get_block(data_key);
    var tab_list = $("<ul/>").attr("class", "ui-tabs-nav");
    dest.append(tab_list);
    add_tab(tab_list, "bonds-div", "Bonds")
    add_tab(tab_list, "angles-div", "Angles")
    add_tab(tab_list, "dihedrals-div", "Dihedrals")
    add_tab(tab_list, "chirals-div", "Chirals")
    add_tab(tab_list, "planes-div", "Planes")
    // BONDS
    var bond_table = create_table("bonds",
      ["Atom 1", "Atom 2", "Type", "Value", "Sigma"]);
    var bdiv = $("<div/>").attr("id", "bonds-div").attr("class",
      "ui-tabs-panel");
    dest.append(bdiv);
    bdiv.append(bond_table);
    console.log(data_block);
    var bonds = data_block.loop_dict('_chem_comp_bond');
    for (var i_bond = 0; i_bond < bonds.length; i_bond++) {
      var bond = bonds[i_bond];
      add_row(bond_table, [bond.atom_id_1, bond.atom_id_2, bond.type,
        bond.value_dist, bond.value_dist_esd], [0,1], callback);
    }
    // ANGLES
    var angle_table = create_table("angles",
      ["Atom 1", "Atom 2", "Atom 3", "Value", "Sigma"]);
    var adiv = $("<div/>").attr("id", "angles-div");
    dest.append(adiv);
    adiv.append(angle_table);
    var angles = data_block.loop_dict("_chem_comp_angle");
    for (var i_angle = 0; i_angle < angles.length; i_angle++) {
      var angle = angles[i_angle];
      add_row(angle_table, [angle.atom_id_1, angle.atom_id_2,
        angle.atom_id_3, angle.value_angle, angle.value_angle_esd], [0,1,2],
        callback);
    }
    // DIHEDRALS
    var dihedral_table = create_table("dihedrals",
      ["Atom 1", "Atom 2", "Atom 3", "Atom 4", "Value", "Sigma", "Period"]);
    var ddiv = $("<div/>").attr("id", "dihedrals-div");
    dest.append(ddiv);
    ddiv.append(dihedral_table);
    var dihedrals = data_block.loop_dict("_chem_comp_tor");
    for (var i_dihe = 0; i_dihe < dihedrals.length; i_dihe++) {
      var dihedral = dihedrals[i_dihe];
      add_row(dihedral_table, [dihedral.atom_id_1, dihedral.atom_id_2,
        dihedral.atom_id_3, dihedral.atom_id_4, dihedral.value_angle,
        dihedral.value_angle_esd, dihedral.period], [0,1,2,3], callback);
    }
  }
  dest.tabs();
}

function add_tab (tabs, anchor, label) {
  var tab = $("<li/>").append(
    $("<a/>").attr("href", "#" + anchor).attr("class",
      "ui-tabs-anchor").text(label));
  tabs.append(tab);
  return tabs;
}

function create_table (table_id, columns) {
  var table = $("<table/>").attr("id", table_id).attr("class",
    "data_display_narrow");
  var header = $("<tr/>").attr("class", "header");
  table.append(header);
  for (var i = 0; i < columns.length; i++) {
    header.append($("<td/>").attr("class", "data_cell").text(columns[i]));
  }
  return table;
}

function add_row (table, cells, label_fields, callback) {
  var row = $("<tr/>").attr("class", "content");
  for (var i = 0; i < cells.length; i++) {
    row.append($("<td/>").attr("class", "data_cell").text(cells[i]));
  }
  table.append(row);
  if (label_fields) {
    var atom_labels = []; 
    for (var i in label_fields) {
      atom_labels.push(cells[i]);
    }
    row.data(atom_labels);
    row.click(function () {
      OnSelect($(this), table, callback);
    });
  }
  return row;
}

// event handler for selecting a restraint (i.e. <tr> object)
function OnSelect (row, table, callback) {
  table.find("tr").each(function () {
    if ($(this).attr("class") == "selected") {
      $(this).attr("class", "content");
    }
  });
  row.attr("class", "selected");
  var atom_data = row.data();
  var atom_names = [];
  for (var key in atom_data) {
    atom_names.push(atom_data[key]);
  }
  callback(atom_names);
}
