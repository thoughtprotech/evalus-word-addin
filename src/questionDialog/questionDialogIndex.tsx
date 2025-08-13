import * as React from "react";
import * as ReactDOM from "react-dom";
import QuestionDialog from "./QuestionDialog";

Office.onReady(() => {
  ReactDOM.render(<QuestionDialog />, document.getElementById("question-dialog-root"));
});
