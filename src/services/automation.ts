import axios from 'axios';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const VERCEL_TOKEN = process.env.VERCEL_TOKEN;

export const githubService = {
  async createRepoFromTemplate(repoName: string, templateRepo: string) {
    const [owner, repo] = templateRepo.split('/');
    const response = await axios.post(
      `https://api.github.com/repos/${owner}/${repo}/generate`,
      {
        name: repoName,
        private: true,
      },
      {
        headers: {
          Authorization: `token ${GITHUB_TOKEN}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );
    return response.data;
  },
};

export const vercelService = {
  async createProject(name: string, repoId: string) {
    const response = await axios.post(
      `https://api.vercel.com/v9/projects`,
      {
        name,
        gitRepository: {
          type: 'github',
          repo: repoId,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${VERCEL_TOKEN}`,
        },
      }
    );
    return response.data;
  },

  async addCustomDomain(projectId: string, domain: string) {
    const response = await axios.post(
      `https://api.vercel.com/v9/projects/${projectId}/domains`,
      {
        name: domain,
      },
      {
        headers: {
          Authorization: `Bearer ${VERCEL_TOKEN}`,
        },
      }
    );
    return response.data;
  },

  async getDomainConfig(projectId: string, domain: string) {
    const response = await axios.get(
      `https://api.vercel.com/v10/projects/${projectId}/domains/${domain}/config`,
      {
        headers: {
          Authorization: `Bearer ${VERCEL_TOKEN}`,
        },
      }
    );
    return response.data;
  },

  async verifyDomain(projectId: string, domain: string) {
    const response = await axios.post(
      `https://api.vercel.com/v9/projects/${projectId}/domains/${domain}/verify`,
      {},
      {
        headers: {
          Authorization: `Bearer ${VERCEL_TOKEN}`,
        },
      }
    );
    return response.data;
  },
};
