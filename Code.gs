const jiraToken = 'YOUR_JIRA_TOKEN' //'Basic XXX'
const githubToken = 'YOUR_GITHUB_TOKEN' // 'Bearer XXX'

function doGet(e) {
  switch (e.parameter.executionType) {
    case "updateForJIRA":
      return updateForJIRA(e.parameter);
    case "updateForGithub":
      return updateForGithub(e.parameter);
    default:
      return ContentService.createTextOutput("Nothing has been executed");
  }
}

function updateForJIRA(parameter) {
  let sheetName = parameter.sheetName;
  let assignee = parameter.assignee;
  let query = parameter.query;

  if (sheetName && query) {
    updateSheetWithJiraAPIData(sheetName, assignee, query);
    return ContentService.createTextOutput("JIRA function executed successfully for " + sheetName)
  } else {
    return ContentService.createTextOutput("JIRA function could not be executed: missing parameters.")
  }
}

function updateForGithub(parameter) {
  let sheetName = parameter.sheetName;
  let username = parameter.username;
  let startDate = parameter.startDate;
  let endDate = parameter.endDate;

  if (sheetName && username && startDate && endDate) {
    processPullRequests(sheetName, username, startDate, endDate)
    return ContentService.createTextOutput("GitHub function executed successfully for " + username)
  } else {
    return ContentService.createTextOutput("GitHub function could not be executed: missing parameters.")
  }
}

// JIRA functions

const jiraUrl = `https://glovoapp.atlassian.net/rest/api/3/search?expand=changelog&jql=`;
const jiraOptions = {
  method: 'GET',
  headers: {
    'Authorization': jiraToken,
    'Accept': 'application/json'
  }
};

function fetchJiraData(url, options) {
  try {
    var startAt = 0;
    var maxResults = 50;
    var total;
    var allData = [];

    do {
      // URL should be updated to include the 'startAt' parameter
      var urlPaginated = url + '&startAt=' + startAt + '&maxResults=' + maxResults;
      console.log(urlPaginated);

      var response = UrlFetchApp.fetch(urlPaginated, options);
      var data = JSON.parse(response.getContentText());

      allData = allData.concat(data.issues);

      total = data.total;
      startAt += maxResults;
    } while (startAt < total)

    return allData

  } catch (error) {
    console.error('Failed to fetch JIRA data', error);
    return null;
  }
}

function updateSheetWithJiraAPIData(sheetName, assignee, query) {

  let assigneeQuery = assignee != null ? ('assignee = ' + assignee + ' AND ') : "";
  let jqlQuery = assigneeQuery + query;

  let finalUrl = jiraUrl + encodeURIComponent(jqlQuery).replace(/'/g, "%27");

  const issues = fetchJiraData(finalUrl, jiraOptions);

  if (!issues) return;

  const sheet = SpreadsheetApp.getActive().getSheetByName(sheetName);

  let startRow = 6;
  let startColumn = 1;
  sheet.getRange(startRow, startColumn, 400, 11).clearContent();

  let maxStoryPoints = 8;

  for (var i = 0; i < issues.length; i++) {
    let issue = issues[i];
    var biggestStoryPoint = parseInt(issue.fields.customfield_10050) <= maxStoryPoints
    ? parseInt(issue.fields.customfield_10050)
    : 0;

    for (var j = 0; j < issue.changelog.histories.length; j++) {
      let history = issue.changelog.histories[j];

      var firstStartDate;
      var lastStartDate;
      var endDate;

      for (var k = 0; k < history.items.length; k++) {
        let historyItem = history.items[k];

        if (historyItem.fieldId == 'customfield_10050') {
          
          const currentStoryPointFrom = parseInt(historyItem.fromString) <= maxStoryPoints 
          ? parseInt(historyItem.fromString)
          : 0;
          const currentStoryPointTo = parseInt(historyItem.toString) <= maxStoryPoints
          ? parseInt(historyItem.toString)
          : 0;

          let currentStoryPoint = currentStoryPointFrom > currentStoryPointTo 
          ? currentStoryPointFrom 
          : currentStoryPointTo

          if (biggestStoryPoint == null || currentStoryPoint > biggestStoryPoint) {
            biggestStoryPoint = currentStoryPoint;
          }
        }

        let historyDateCreated = new Date(history.created);

        if (historyItem.fieldId == 'status' && historyItem.toString == "In progress") {
          if (firstStartDate == null || historyDateCreated > firstStartDate) {
            firstStartDate = historyDateCreated
          }
        }

        if (historyItem.fieldId == 'status' && (historyItem.fromString == "Icebox" || historyItem.fromString == "TODO")) {
          if (lastStartDate == null || historyDateCreated > lastStartDate) {
            lastStartDate = historyDateCreated
          }
        }

        if (historyItem.fieldId == 'status' && historyItem.toString == "Closed") {
          if (endDate == null || endDate < historyDateCreated) {
            endDate = historyDateCreated
          }
        }
      }
    }

    if (lastStartDate == null) {
      lastStartDate = new Date(issue.fields.resolutiondate);
    }
    if (endDate == null) {
      endDate = new Date(issue.fields.resolutiondate);
    }

    let startDateMidPoint = firstStartDate != null 
      ? new Date((lastStartDate.getTime() + firstStartDate.getTime()) / 2) 
      : lastStartDate;

    let differenceInMilliseconds = endDate - startDateMidPoint;
    var differenceInDays = (differenceInMilliseconds / (1000 * 60 * 60 * 24)).toFixed(1);

    let parent = issue.fields.parent?.fields.summary != null ? issue.fields.parent?.fields.summary : "";
    let sprintName = issue.fields.customfield_10010 != null ? issue.fields.customfield_10010[0].name : "";

    let formattedResolutionDate = issue.fields.resolutiondate != null ? (new Date(issue.fields.resolutiondate)).toLocaleDateString() : null;

    let rowValues = [
      issue.key, issue.fields.project.name,
      sprintName,
      issue.fields.summary,
      issue.fields.labels.join(', '),
      issue.fields.priority?.name,
      biggestStoryPoint ?? 0,
      differenceInDays >= 0 && formattedResolutionDate!= null ? differenceInDays : null,
      formattedResolutionDate,
      parent,
      issue.fields.customfield_10000 != "{}" ? "YES" : "NO"];

    for (let j = 0; j < rowValues.length; j++) {
      sheet.getRange(startRow + i, startColumn + j).setValue(rowValues[j]);
    }

    firstStartDate = null;
    lastStartDate = null;
    startDateMidPoint = null;
    endDate = null;
  }
}

// GITHUB functions

const githubOptions = {
  method: 'GET',
  headers: {
    'Authorization': githubToken,
    'Accept': 'application/vnd.github+json',
  }
};

function fetchAllPullRequests(username, startDate, endDate, page = 1, pullRequests = []) {
  try {
    let firstURL = `https://api.github.com/search/issues?q=type:pr+author:${username}+created:${startDate}..${endDate}&page=${page}&per_page=100`
    const response = UrlFetchApp.fetch(firstURL, githubOptions);
    const data = JSON.parse(response.getContentText());

    if (data.length === 0) {
      console.error(`An error occurred`);
    }

    // Concatenate the current page's pull requests with previously fetched pull requests.
    pullRequests = pullRequests.concat(data.items);

    // If there are more pages, fetch the next page recursively.
    if (data.total_count > page * 100) {
      return fetchAllPullRequests(username, startDate, endDate, page + 1, pullRequests);
    } else {
      // All pages have been fetched, now fetch additional details for each pull request.
      for (const pr of pullRequests) {
        const repo = pr.repository_url.split("https://api.github.com/repos/")[1];

        let secondURL = `https://api.github.com/repos/${repo}/pulls/${pr.number}`;
        console.log(secondURL);

        const prResponse = UrlFetchApp.fetch(secondURL, githubOptions);
        const prData = JSON.parse(prResponse.getContentText());

        if (prData.length === 0) {
          console.error(`An error occurred`);
        }

        pr.comments = prData.comments;
        pr.review_comments = prData.review_comments;
        pr.additions = prData.additions;
        pr.deletions = prData.deletions;
        pr.changed_files = prData.changed_files;
      }

      return pullRequests;
    }
  } catch (error) {
    console.error('Failed to fetch GitHub data', error);
    return null;
  }
}

function processPullRequests(sheetName, username, startDate, endDate) {
  let pullRequests = fetchAllPullRequests(username, startDate, endDate)
  if (!pullRequests) return;

  let sheet = SpreadsheetApp.getActive().getSheetByName(sheetName);

  let startRow = 6;
  let startColumn = 13;
  sheet.getRange(startRow, startColumn, 400, 7).clearContent();

  for (var i = 0; i < pullRequests.length; i++) {
    var pr = pullRequests[i];

    let prCreatedAt = new Date(pr.created_at);
    let prClosedAt = pr.closed_at != null ? new Date(pr.closed_at) : null;
    let prClosedAtString = prClosedAt != null ? prClosedAt.toLocaleDateString() : null;

    let differenceInDays = prClosedAt != null
      ? ((prClosedAt - prCreatedAt) / (1000 * 60 * 60 * 24)).toFixed(1)
      : "Open"

    let rowValues = [
      pr.title,
      pr.additions,
      pr.deletions,
      differenceInDays,
      pr.comments,
      pr.review_comments,
      prClosedAtString
    ];

    for (let j = 0; j < rowValues.length; j++) {
      sheet.getRange(startRow + i, startColumn + j).setValue(rowValues[j]);
    }
  }
}
