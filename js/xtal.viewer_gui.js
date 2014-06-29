/*

xtal.js Various GUI objects for standalone model+map viewer.

Exports:

*/
var xtal = (function(module) {return module})(xtal||{});
xtal.viewer = (function(module) {
	// Exports
	return {
	}
})(xtal);

// draw the PDB input field widget
function draw_pdb_id_request (viewer, callback) {
  var body = $("body");
  var pdb_div = $("<div/>").attr("class", "centeredControls").attr("id",
    "loadControls").append(
      $("<form/>").attr("id", "pdbIdForm").append(
        $("<div/>").attr("class", "controlItem").attr("id", "pdbFetch").append(
          $("<span/>").text("Load PDB ID:"),
          $("<input/>").attr("type", "text").attr("id", "pdbIdInput").attr(
            "class", "pdbIdInput")
     //     $("<input/>").attr("type", "submit").attr("style", "display:none")
        )));
  $(document).on("submit", "#pdbIdForm", function (event) {
    event.preventDefault();
    var pdb_id = $("#pdbIdInput").val();
    collapsePanel();
    callback(viewer, pdb_id);
    return false;
  });
  body.append(pdb_div);
  var show_btn = $("<div/>").attr("class", "controlButton").attr("id",
    "loadControlsButton").append(
      $("<div/>").attr("class", "controlMargin").attr("id",
        "loadControlsBtnMargin").append(
        $("<div/>").attr("class", "controlItem").attr("id",
          "loadControlsShow").text("Load structure...")));
  body.append(show_btn);
}

function draw_selection_console (viewer) {
  var body = $("body");
  var sel_div = $("<div/>").attr("id", "selectionWindow").append(
    $("<form/>").attr("id", "selectionForm").append(
      $("<div/>").attr("class", "controlItem").attr("id", "atomSel").append(
        $("<span/>").text("Select atoms:"),
        $("<input/>").attr("type", "text").attr("id", "selectionInput").attr(
          "class", "selectionInput"))));
  $(document).on("submit", "#selectionForm", function (event) {
    event.preventDefault();
    var selection_str = $("#selectionInput").val();
    collapsePanel();
    viewer.select_atoms(selection_str);
    return false;
  });
  body.append(sel_div);
  var show_btn = $("<div/>").attr("class", "controlButton").attr("id",
    "selectionControlsButton").append(
      $("<div/>").attr("class", "controlMargin").attr("id",
        "selectionControlsBtnMargin").append(
        $("<div/>").attr("class", "controlItem").attr("id",
          "selectionControlsShow").text("Select atoms...")));
  body.append(show_btn);
  $('#selectionControlsButton').click(expandSelection);
}

function draw_feature_list (viewer) {
  var body = $("body");
  var features_div = $("<div/>").attr("class", "controlBox").attr("id",
    "featureBox").append(
      $("<div/>").attr("id", "featuresBoxInner").append(
        $("<div/>").attr("class", "controlMargin").append(
          $("<div/>").attr("class", "controlHeader").attr("id",
            "featureHandle").text("Important features"))));
  body.append(features_div);
}

function expandPanel() {
  $('#loadControls').fadeIn('fast');
  $('#loadControlsButton').click(collapsePanel);
  $('#loadControlsShow').text("Hide controls");
};

function collapsePanel() {
  $('#loadControls').fadeOut('fast');
  $('#loadControlsButton').unbind('click');
  $('#loadControlsButton').click(expandPanel);
  $('#loadControlsShow').text("Load structure...");
};

function expandSelection() {
  $("#selectionWindow").slideDown("fast");
  $('#selectionControlsButton').unbind('click');
  $("#selectionControlsButton").click(collapseSelection);
  $("#selectronControlsShow").text("Hide selection window");
}

function collapseSelection() {
  $("#selectionWindow").slideUp("fast");
  $('#selectionControlsButton').unbind('click');
  $("#selectionControlsButton").click(expandSelection);
  $("#selectronControlsShow").text("Select atoms...");
}

function expandFeatures() {
  //$("#featureHeader").toggle(false);
  $("#featureList").slideDown('fast');
  $('#featureHandle').click(collapseFeatures);
};

function collapseFeatures() {
  //$("#featureHeader").toggle(true);
  $("#featureList").slideUp('fast');
};

function init_gui () {
  $(document).ready(function() {
    /* expandPanel on click, too - good for mobile devices without mouse */
    $('#loadControlsButton').click(expandPanel);
    $('#selectionControlsButton').click(expandSelection);
    var feature_handle = $('#featureHandle');
    if (feature_handle) {
      $('#featureHandle').click(expandFeatures);
      $('#featureHandle').hoverIntent({
        over: expandFeatures,
        timeout: 10,
        out: function() {return true;}
      });
      $('#featureList').hoverIntent({
        over: function() { return true;},
        timeout: 10,
        out: collapseFeatures
      });
    }
  });
}

function display_features_gui (viewer, features) {
  $("#featureList").empty();
  console.log("Adding " + features.length + " features");
  expandFeatures();
  for (var i = 0; i < features.length; i++) {
    var inner = $("<div/>", {
      id:"feature"+i,
      class:"featureItem"}).text(features[i][0]);
    var outer = $("<div/>", {
        id:"featuresMargin",
        class:"controlMargin" }).text('');
    outer.append(inner);
    outer.appendTo("#featureList");
    inner.data("Data",{
        label: features[i][0],
        xyz: features[i][1]
      });
    inner.click(function () {
      var data = $(this).data("Data");
      viewer.zoomXYZ(data.xyz);
    });
  }
  //$("featureList").html();
  list_height = 0
  list_height = $("#featuresBoxInner").height();
  //$("#featuresBoxInner").children().each(function () {
  //  list_height += $(this).height();
  //});
  console.log("height: " + list_height);
  //$("#featureBox").height(Math.min(200, list_height));
}

function getQuery(viewer, query) {
  if (! query) {
    query = window.location.search.substring(1);
  }
  var vars = query.split("&");
  have_query = false;
  for (var i=0;i<vars.length;i++) {
    var pair = vars[i].split("=");
    if (pair[0] == 'model') {
      viewer.load_mmcif("data/" + pair[1] + ".cif", pair[1]);
      have_query = true;
    } else if (pair[0] == "cif") {
      viewer.load_cif("data/" + pair[1] + ".cif", pair[1]);
      have_query = true;
    } else if (pair[0] == 'monlib') {
      viewer.load_mon_lib("data/" + pair[1] + ".cif", pair[1]);
      have_query = true;
    } else if (pair[0] == "pdb") {
      viewer.load_pdb("data/" + pair[1] + ".pdb", pair[1]);
      have_query = true;
    } else if (pair[0] == "map") {
      viewer.load_ccp4_map("data/" + pair[1], pair[1], 0);
      have_query = true;
    } else if (pair[0] == "omap") {
      viewer.load_dsn6_map("data/" + pair[1], pair[1], 0);
      have_query = true;
    }
  }
  if (have_query) {
    viewer.animate();
  }
  return have_query;
}

function requestFromServer (viewer) {
  collapsePanel();
  viewer.reset();
  var pdb_id = $("#pdbIdInput").val();
  viewer.requestPDB(pdb_id);
}

function loadPDBFromForm (viewer, pdb_id) {
  validate_pdb_id(pdb_id);
  viewer.fetchPDB(pdb_id);
}

function loadEDSFromForm (viewer, pdb_id) {
  viewer.reset();
  viewer.load_eds_maps(pdb_id);
}

function getEDSQuery (viewer, query) {
  if (! query) {
    query = window.location.search.substring(1);
  }
  var vars = query.split("&");
  have_query = false;
  for (var i=0;i<vars.length;i++) {
    var pair = vars[i].split("=");
    if (pair[0] == "pdb") {
      viewer.load_eds_maps(pair[1]);
      return true;
    }
  }
  return false;
}
