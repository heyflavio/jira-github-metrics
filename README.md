


# JIRA & GitHub metrics

![CleanShot 2023-08-13 at 20 21 58@2x](https://github.com/flaviobtc/jira-github-metrics/assets/7707190/fbddc02e-5196-4694-8114-55546f3c03ea)


Fetch metrics from JIRA and GitHub for a given set of users, for helping you checking information and visualize trends more easily.

In order to create your own spreadsheet, follow the given steps:

##  1. Make a copy of the Spreadsheet template
You can find the template [here](https://docs.google.com/spreadsheets/d/1ZhT8W2BHU6Xpbz0DtTIRGxtvqTffHAcMFYvBk9ao5TE/edit?usp=sharing), with the given script already associated (you may also find the same script in this repository). All you need to do is make a copy of it for yourself.

## 2. Insert your JIRA & GitHub API tokens

Add your own tokens from [JIRA](https://support.atlassian.com/atlassian-account/docs/manage-api-tokens-for-your-atlassian-account/) and [GitHub](https://github.com/settings/tokens) in order to access their APIs:
- For the JIRA token, it is necessary to prepend your email to it (ex.: ```flavio@email.com:YOUR_JIRA_TOKEN```), and encode it using [base64](https://www.base64encode.org/).
- For GitHub, create a **Personal access tokens (classic)**, and provide the needed accesses: repo, user & project.
  - It is necessary to authorize access to your company repositories via SSO.
- Access your newly copied associated spreadsheet script via Apps Script (In the copied spreadsheet, access *'Extensions -> Apps Script'*). It is necessary to replace the first two lines of code:

```javascript 
const jiraToken = 'Basic YOUR_EMAIL_&_JIRA_TOKEN_ENCODED'; // 'Basic XXX' 
const githubToken = 'Bearer YOUR_GITHUB_TOKEN'; // 'Bearer XXX'
```

## 3. Deploy a new Web app in Apps Script
In order to generate an execution URL for your script, generate a New Deployment of an Web app type.

## 4. Configure the Web app execution URL
Add the newly generated Web App execution URL into the 'Settings' tab within your spreadsheet (*B2 cell*).

## 5. Configure the 'Engineer' sheets
For fetching information of a given engineer, you need to follow three steps:
- Update both the sheet name and the given engineer name (*B2 cell*) to the same name/identifier. *Ex.: John Doe*.
- Add their given JIRA_ID (*B3 cell*) and GITHUB_USERNAME (*N3 cell*).
- Execute the correspondent generated scripts in C2 cell for JIRA and N2 cell for GitHub.

## 6. Configure the 'Team' sheet
Team sheet uses its own query, but works similarly to the Engineering one:
- Update both the sheet name and the given team/project name (*B2 cell*) to the same name/identifier. Ex.: Payment Experience
- Also, it is necessary to adequate the query to your own needs. For example, update the project name: project = 'PX'.

## 'Team Overview' & 'Per Platform trends' tabs
Both are automatically populated according to the changes in the Engineer sheet(s). It might be necessary to adjust some charts if adding more engineers for a given platform (Android, iOS, and so on).

### Known issue(s)
- When updating the Engineer(s) sheet(s), sometimes Google sheets doesn't automatically updates the information in the 'Team Overview' sheet. It is necessary to tweak it by "dragging" the functions from a given row above or below.
*Example: The information for line 5 (B5-AA5) is missing even if with all pulled information for "Engineer 1". Drag the formulas from range B6-AA6 to range B5-AA5. This will update the information accordingly.*
