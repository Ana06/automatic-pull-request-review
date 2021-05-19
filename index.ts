import * as core from '@actions/core';
import * as github from '@actions/github';

/** Returns true if any review in the reviews array has author's login
'github-actions' and the body given as parameter  */
function isAnyDuplicatedReview(reviews: Array<any>, body: string): boolean {
  for (let review of reviews) {
    if(review.author.login === 'github-actions' && review.body === body){
      core.info('Duplicated review');
      return true;
    }
  }
  core.info('No duplicated review');
  return false;
}

/** Gets the PR reviews by querying the GitHub API (GraphQL) and calls
isAnyDuplicatedReview to know if any of them is a duplicate */
async function existsDuplicatedReview(octokit: any, reviewState: string, pullRequest: any, body: string): Promise<boolean | undefined > {
  const repo = pullRequest.base.repo
  const query = `
    query {
    repository(owner: "${repo.owner.login}", name: "${repo.name}") {
      pullRequest(number: ${pullRequest.number}) {
        reviews(last: 100, states: ${reviewState}) {
          nodes {
            author {
              login
            }
            body
          }
        }
      }
    }
  }`;

  try {
    const { repository } = await octokit.graphql(query, {});
    const reviews = repository.pullRequest.reviews.nodes
    return isAnyDuplicatedReview(reviews, body);
  }
  catch (err) {
    core.error(`${err} ${query}`);
    core.setFailed(err.message);
  }
}

/** Send the review if there is not a duplicate or if duplicates are allowes */
async function sendReview(octokit: any, reviewState: string, pullRequest: any, body: string, allow_duplicate: boolean): Promise<void> {
  if(allow_duplicate || !(await existsDuplicatedReview(octokit, reviewState, pullRequest, body))) {
    const query = `
      mutation {
        addPullRequestReview(input: {
        pullRequestId: "${(<any>pullRequest)['node_id']}",
        event: ${requestEvent},
        body: "${body}"
      }) {clientMutationId}
    }`;
    octokit.graphql(query).catch((err: Error) => {
      core.error(`${err} ${query}`);
      core.setFailed(err.message);
    });
  }
}

const token = core.getInput('repo-token');
const requestEvent = core.getInput('event');
const body = core.getInput('body');
const allow_duplicate = core.getInput('allow_duplicate').toUpperCase() === 'TRUE';
const pullRequestReviewState : Record<string, string> = {
  APPROVE: 'APPROVED',
  COMMENT: 'COMMENTED',
  DISMISS: 'DISMISSED',
  REQUEST_CHANGES: 'CHANGES_REQUESTED'
}

const octokit = github.getOctokit(token)

if (
  (requestEvent === 'COMMENT' || requestEvent === 'REQUEST_CHANGES') &&
  !body
) {
  core.setFailed('Event type COMMENT & REQUEST_CHANGES require a body.');
}

const pullRequest = github.context.payload['pull_request'];

if (!pullRequest) {
  core.setFailed('This action is meant to be ran on pull requests');
}


const reviewState = pullRequestReviewState[requestEvent];
sendReview(octokit, reviewState, pullRequest, body, allow_duplicate);
