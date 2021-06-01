$(document).ready(function () {
    bindSearchTable();
    bindQueryRun();
});

function bindQueryRun() {
    $(".query-form").submit(function (e) {
        e.preventDefault();
        const resEl = $("#res");
        const thisEl = $(this);
        const url = thisEl.attr("action");
        const data = {
            "SQL": thisEl.find("textarea[name=SQL]").val()
        };

        resEl.html("... loading ...");

        $.post(url, data, function (ans) {
            resEl.html(ans);
        });

        return false;

    });
}

function bindSearchTable() {
    $(".search-table").submit(function (e) {
        e.preventDefault();
        const thisEl = $(this);
        const trList = thisEl.find("tr");
        const database = thisEl.attr("data-base");
        const table = thisEl.attr("data-table");
        let resEl = $("#res");
        let searchPairs = [];
        resEl.html("");

        trList.each(function () {
            const tr = $(this);
            const field = "`" + tr.attr("data-field") + "`";
            const op = tr.find("select[name=operation\\[\\]]").val();
            const vval = tr.find("input[name=field\\[\\]]").val();
            const v = "'" + vval + "'";

            
            
            if (op == "isNull") {
                searchPairs.push(field + "IS NULL");
            } else if (op == "isNotNull") {
                searchPairs.push(field + "IS NOT NULL");
            } else if (op == "!=" && vval) {
                searchPairs.push(field + "!=" + v);
            } else if (op == "g" && vval) {
                searchPairs.push(field + ">" + v);
            } else if (op == "l" && vval) {
                searchPairs.push(field + "<" + v);
            } else if (op == "ge" && vval) {
                searchPairs.push(field + ">=" + v);
            } else if (op == "le" && vval) {
                searchPairs.push(field + "<=" + v);    
            } else if (op == "Like" && vval) {
                searchPairs.push(field + " LIKE " + v);
            } else if (op == "notLike" && vval) {
                searchPairs.push(field + " NOT LIKE  " + v);
            } else if (op == "specLike" && vval) {
                searchPairs.push(field + " LIKE '%" + vval + "%'");
            } else if (vval) {
                searchPairs.push(field + "=" + v);
            } 
        });

        const where = searchPairs.length > 0 
            ? " WHERE " + searchPairs.join(" AND ")
            : "";

        const query = "SELECT * FROM " + table + where;
        const data = {
            "SQL": query
        };

        resEl.html("... loading ...");

        $.post("/database-query-do/" + database + "/" + table, data, function (ans) {
            resEl.html(ans);
        });

        return false;
    });
}
