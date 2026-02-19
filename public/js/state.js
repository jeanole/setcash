// ========== Global State ==========

var motivesData = [];
var categoriesData = [];
var rolesData = [];
var allBills = [];
var allLogs = [];
var currentBillId = null;
var currentUser = null;

// Bills filter, sort & pagination state
var billFilters = { person: '', motive: '', category: '', role: '', type: '', dateFrom: '', dateTo: '', search: '' };
var billSort = { column: null, dir: 'asc' };
var billPage = 1;
var BILLS_PER_PAGE = 20;

// Multi-image upload state
var pendingFiles = [];

// Gallery state
var galleryImages = [];
var galleryIndex = 0;

// V-Geld state
var allVGeld = [];

// Budget state
var budgetData = null;

// Admin state
var positionsCache = [];

// Super admin state
var saAllProjects = [];
var saAllUsers = [];
var saCurrentUserEmail = '';
var saMembershipPositions = [];
var saCurrentMembers = [];
var saCurrentProjectId = null;
