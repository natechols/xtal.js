
// enumeration of content types
var CONTENT_SUB_HEADER = 1;
var CONTENT_PARA_HEADER = 2;
var CONTENT_TEXT = 3;
var CONTENT_PREFORMATTED = 4;
var CONTENT_TABLE = 5;
var CONTENT_PLOT = 6;
var CONTENT_PLOT_TABLE = 7;
var CONTENT_BREAK = 8;

function display_content (content) {
  var display = $("#content");
  display.empty();
  var title = $("#title");
  title.empty();
  title.text(content.title);
  var selection = $("#selectSection");
  selection.empty();
  var sections = content.sections;
  display.data(sections);
  for (var i_section = 0; i_section < sections.length; i_section++) {
    console.log(sections[i_section].title);
    selection.append($("<option/>").val(i_section).text(
      sections[i_section].title));
  }
  selection.change(function () {
    var i_section = parseInt($("#selectSection").val());
    display_section(i_section);
  });
  display_section(0);
}

function display_section (i_section) {
  var display = $("#content");
  display.empty();
  all_content = display.data();
  var section = all_content[i_section];
  display.append($("<h3/>").text(section.title));
  display.append($("<hr/>"));
  i_graph = 0;
  for (var i_content = 0; i_content < section.content.length; i_content++) {
    var block = section.content[i_content];
    if (block.content_type == CONTENT_SUB_HEADER) {
      display.append($("<h4/>").text(block.content));
    } else if (block.content_type == CONTENT_PARA_HEADER) {
      display.append($("<h5/>").text(block.content));
    } else if (block.content_type == CONTENT_TEXT) {
      display.append($("<p/>").text(block.content));
    } else if (block.content_type == CONTENT_PREFORMATTED) {
      display.append($("<pre/>").text(block.content));
    } else if (block.content_type == CONTENT_TABLE) {
      console.log("TABLE");
      var table = $("<table/>").attr("class", "data_display");
      for (var i_row = 0; i_row < block.content.rows.length; i_row++) {
        var row = block.content.rows[i_row];
        var tr = $("<tr/>");
        table.append(tr);
        if (i_row == 0) {
          tr.attr("class", "header");
        } else {
          tr.attr("class", "content");
        }
        for (var i_col = 0; i_col < row.length; i_col++) {
          tr.append($("<td/>").text(row[i_col]).attr("class", "data_cell"));
        }
      }
      display.append(table);
    } else if (block.content_type == CONTENT_PLOT) {
      var graph_id = "graph" + i_graph;
      display.append($("<div/>").attr("id", graph_id).attr("class",
        "loggraph"));
      var graph = new xtal.loggraph.Loggraph("#" + graph_id, [ block.content ], i_graph,
        true);
      i_graph++;
      display.append($("<br/>"));
    }
  }
}
