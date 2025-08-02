import * as React from "react";
import * as ReactDOM from "react-dom";
import Dialog from "./Dialog";

Office.onReady(() => {
  ReactDOM.render(<Dialog />, document.getElementById("dialog-root"));
});
