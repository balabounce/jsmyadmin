const Controllers = require('./kernel/controllers.js');
const Routes = require('./kernel/router.js');
const App = require('./kernel/app.js');

let router = Routes.router;

router.get("", Controllers.indexController, false);
router.get("login", Controllers.loginController, true);
router.get("logout", Controllers.logoutController, false);
router.get("auth", Controllers.authController, true);
router.get("database", Controllers.databaseController, false);
router.get("database-query", Controllers.queryController, false);
router.get("database-query-do", Controllers.queryActionController, false);
router.get("database-table", Controllers.tableController, false);
router.get('table-delete', Controllers.tableDeleteController, false);
router.get('table-delete-confirmed', Controllers.tableDeleteConfirmedController, false);
router.get("database-table-insert", Controllers.rowInsertController, false);
router.get("database-table-insert-do", Controllers.rowInsertActionController, false);
router.get("database-table-edit", Controllers.rowEditController, false);
router.get("database-table-edit-do", Controllers.rowEditActionController, false);
router.get("database-table-delete", Controllers.rowDeleteController, false);
router.get("database-table-delete-confirmed", Controllers.rowDeleteConfirmedController, false);
router.get('database-create', Controllers.databaseCreateController, false);
router.get('database-delete', Controllers.databaseDeleteController, false);
router.get('database-delete-confirmed', Controllers.databaseDeleteConfimedController, false);
router.get('select-builder', Controllers.selectBuilderController, false);
router.get('database-import', Controllers.databaseImportController, false);
router.get('database-export', Controllers.databaseExportController, false);
App.engine.run(router);
