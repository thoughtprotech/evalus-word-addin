import * as React from "react";
import Header from "./Header";
import HeroList, { HeroListItem } from "./HeroList";
import TextInsertion from "./TextInsertion";
import { makeStyles } from "@fluentui/react-components";
import { Ribbon24Regular, LockOpen24Regular, DesignIdeas24Regular } from "@fluentui/react-icons";
import { insertText } from "../taskpane";

interface AppProps {
  title: string;
}

const useStyles = makeStyles({
  root: {
    minHeight: "100vh",
    padding: "1rem",
  },
  jsonOutput: {
    marginTop: "1rem",
    padding: "1rem",
    backgroundColor: "#f5f5f5",
    border: "1px solid #ccc",
    borderRadius: "5px",
    whiteSpace: "pre-wrap",
    wordWrap: "break-word",
    fontFamily: "monospace",
    fontSize: "14px",
    maxHeight: "300px",
    overflowY: "auto",
    color: "black"
  },
});

const App: React.FC<AppProps> = (props: AppProps) => {
  const styles = useStyles();

  const listItems: HeroListItem[] = [
    {
      icon: <Ribbon24Regular />,
      primaryText: "Achieve more with Office integration",
    },
    {
      icon: <LockOpen24Regular />,
      primaryText: "Unlock features and functionality",
    },
    {
      icon: <DesignIdeas24Regular />,
      primaryText: "Create and visualize like a pro",
    },
  ];

React.useEffect(() => {
  const fetchJson = async () => {
    try {
      const storedJson = await OfficeRuntime.storage.getItem("lastExtractedJson");
      if (storedJson) {
        const json = JSON.parse(storedJson);
        console.log("📦 Retrieved JSON from OfficeRuntime.storage:", json);

        const div = document.getElementById("jsonOutput");
        if (div) {
          div.textContent = JSON.stringify(json, null, 2);
        }
      }
    } catch (err) {
      console.error("Error retrieving JSON:", err);
    }
  };

  fetchJson();
}, []);


  return (
    <div className={styles.root}>
      <Header logo="assets/logo-filled.png" title={props.title} message="Welcome" />
      <HeroList message="Discover what this add-in can do for you today!" items={listItems} />
      <TextInsertion insertText={insertText} />

      {/* ✅ JSON output viewer */}
      <pre id="jsonOutput" className={styles.jsonOutput}>
        {/* Output will be injected here */}
      </pre>
    </div>
  );
};

export default App;
