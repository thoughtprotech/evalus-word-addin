/*
 * Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT license.
 * See LICENSE in the project root for license information.
 */

import checkFormatHelper from "./utls/checkQuestionFormat";

/* global Office, Word */

Office.onReady(() => {
  // If needed, Office.js is ready to be called.
});

/**
 * Shows a notification when the add-in command is executed.
 * @param event
 */
function action(event: Office.AddinCommands.Event) {
  const message: Office.NotificationMessageDetails = {
    type: Office.MailboxEnums.ItemNotificationMessageType.InformationalMessage,
    message: "Performed action.",
    icon: "Icon.80x80",
    persistent: true,
  };

  // Show a notification message.
  Office.context.mailbox.item?.notificationMessages.replaceAsync(
    "ActionPerformanceNotification",
    message
  );

  event.completed();
}

// Register the existing action
Office.actions.associate("action", action);

// ─── YOUR NEW checkFormat COMMAND ───────────────────────────────────────────────

// ──────────────────────────────────────────────────────────────
// Validate and color-format the document
// ──────────────────────────────────────────────────────────────

// In commands.ts
export async function checkFormat(event?: Office.AddinCommands.Event) {
  const result = await checkFormatHelper();

  if (event && typeof event.completed === "function") {
    event.completed();
  }

  return result;
}

Office.actions.associate("checkFormat", checkFormat);

// Register your checkFormat function
Office.actions.associate("checkFormat", checkFormat);
