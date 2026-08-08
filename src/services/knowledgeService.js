import {
  companyProfile,
  branches,
  users,
  brands,
  suppliers,
  objectives,
  policies,
  glossary,
} from "../knowledge/company";

const knowledgeService = {
  getCompanyProfile() {
    return companyProfile;
  },

  getBranches() {
    return branches;
  },

  getUsers() {
    return users;
  },

  getBrands() {
    return brands;
  },

  getSuppliers() {
    return suppliers;
  },

  getObjectives() {
    return objectives;
  },

  getPolicies() {
    return policies;
  },

  getGlossary() {
    return glossary;
  },

  getCompanyKnowledge() {
    return {
      companyProfile,
      branches,
      users,
      brands,
      suppliers,
      objectives,
      policies,
      glossary,
    };
  },
};

export default knowledgeService;