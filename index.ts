import * as core from '@actions/core';
import * as github from '@actions/github';

core.info('Hola0'); // TODO: Remove!
function existsDuplicate(body: string, requestEvent: string, pullRequest: any): boolean {
  const repo = (<any>github.context.payload)['pull_request']['head']['repo']
  const query = `
  query {
    repository(owner: "${repo['name']}", name: "${repo['owner']['login']}") {
      pullRequest(number: ${pullRequest['number']}) {
        reviews(last: 100, states: ${requestEvent}) {
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

  const result = octokit.graphql(query).catch((err) => {
    core.error(err);
    core.setFailed(err.message);
  });

  const reviews = (<any>result)['data']['repository']['pullRequest']['reviews']['nodes'] as Array<any>
  reviews.forEach(function (review) {
    if(review['author']['login'] === 'github-actions' && review['body'] === body){
      core.info('Duplicated review');
      return true;
    }
  }); 

  return false;
}

const token = core.getInput('repo-token');
const requestEvent = core.getInput('event');
const body = core.getInput('body');
const allow_duplicate = core.getInput('allow_duplicate');

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

core.debug('Hola'); // TODO: Remove!
core.info('Hola'); // TODO: Remove!
if (allow_duplicate || !existsDuplicate(body, requestEvent, pullRequest)){
  const query = (() => {
    if (requestEvent === 'DISMISS'){
      return `
      mutation {
        dismissPullRequestReview(input: {
          message: "${body}",
          pullRequestReviewId: "${(<any>pullRequest)['node_id']}"
        }) {clientMutationId}
      }`;
    } else {
      return `
      mutation {
        addPullRequestReview(input: {
          pullRequestId: "${(<any>pullRequest)['node_id']}",
          event: ${requestEvent},
          body: "${body}"
        }) {clientMutationId}
      }`;
    }
  }) ();

  octokit.graphql(query).catch((err) => {
    core.error(err);
    core.setFailed(err.message);
  });
}
