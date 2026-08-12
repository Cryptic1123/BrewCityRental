let checkoutItems = [];
let returnItems = [];
let customerBalance = 0;

const apiBaseUrl =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1"
    ? "http://localhost:3000"
    : "";

const apiUrl = `${apiBaseUrl}/api/reservations`;

function formatCurrency(amount) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function formatDate(value) {
  return new Date(value).toLocaleDateString("en-US");
}

function initializeNavbar() {
  const navlinks = document.querySelectorAll(".navbar a");
  navlinks.forEach((link) => {
    if (link.href === window.location.href) {
      link.classList.add("active");
    }
  });
}

function updateNavLinksBasedOnLoginStatus() {
  const isLoggedIn = sessionStorage.getItem("customerLoggedIn") === "true";

  const navLinks = document.querySelectorAll(
    'a[href*="customer-login.html"], a[href*="customer-portal.html"]',
  );

  navLinks.forEach((link) => {
    if (isLoggedIn) {
      link.href = link.href.includes("customer-login.html")
        ? link.href.replace("customer-login.html", "customer-portal.html")
        : link.href;
    } else {
      link.href = link.href.includes("customer-portal.html")
        ? link.href.replace("customer-portal.html", "customer-login.html")
        : link.href;
    }
  });
}

function renderCheckoutItems() {
  const table = document.getElementById("checkoutItems");
  table.innerHTML = "";
  checkoutItems.forEach((dvd, index) => {
    table.innerHTML += `
        <tr>
            <td>${dvd.ItemID}</td>
            <td>${dvd.Title}</td>
            <td>${dvd.CategoryName}</td>
            <td>$${Number(dvd.RentalPrice).toFixed(2)}</td>
            <td>
                <button
                    class="btn btn-danger"
                    onclick="removeDVD(${index})">
                    Remove
                </button>
            </td>
        </tr>
        `;
  });
  updateCheckoutTotals();
}

function removeDVD(index) {
  checkoutItems.splice(index, 1);
  renderCheckoutItems();
}

function updateCheckoutTotals() {
  const subtotal = checkoutItems.reduce(
    (sum, item) => sum + Number(item.RentalPrice),
    0,
  );
  const tax = subtotal * 0.055;
  let balanceToPay = 0;
  if (customerBalance > 10) {
    balanceToPay = customerBalance;
  }

  const total = subtotal + tax + balanceToPay;
  document.getElementById("dvdCount").textContent = checkoutItems.length;
  document.getElementById("subtotal").textContent = subtotal.toFixed(2);
  document.getElementById("taxAmount").textContent = tax.toFixed(2);
  document.getElementById("totalAmount").textContent = total.toFixed(2);
  document.getElementById("checkoutBalance").textContent =
    balanceToPay.toFixed(2);
}

function initializeLogin() {
  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", function (e) {
      e.preventDefault();
      const email = document.getElementById("employeeEmail").value;
      const password = document.getElementById("password").value;

      const apiUrl = `${apiBaseUrl}/api/employee/login`;

      fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      })
        .then((res) => {
          if (!res.ok) {
            return res.json().then((j) => Promise.reject(j));
          }
          return res.json();
        })
        .then((data) => {
          const employee = data.employee || {};
          const employeeId =
            employee.EmployeeID || employee.employeeID || employee.id;
          sessionStorage.setItem("employeeLoggedIn", "true");
          sessionStorage.setItem("employeeId", employeeId || "");

          sessionStorage.setItem("employeeRole", employee.Role || "");
          sessionStorage.setItem(
            "employeeManager",
            Number(employee.Manager) === 1 ? "1" : "0",
          );
          sessionStorage.setItem(
            "employeeAdmin",
            Number(employee.Admin) === 1 ? "1" : "0",
          );
          sessionStorage.setItem(
            "employeeName",
            `${employee.FirstName || ""} ${employee.LastName || ""}`.trim(),
          );
          window.location.href = "../employee/dashboard.html";
        })
        .catch((err) => {
          const msg =
            err && err.error
              ? err.error
              : err && err.message
                ? err.message
                : "Login failed";

          alert("Login failed: " + msg);
        });
    });
  }
}

const showPasswordCheckbox = document.getElementById("showPassword");
const passwordInput = document.getElementById("password");
if (showPasswordCheckbox && passwordInput) {
  showPasswordCheckbox.addEventListener("change", function () {
    passwordInput.type = this.checked ? "text" : "password";
  });
}

function initializeEmployeeDashboard() {
  const employeeRole = Number(sessionStorage.getItem("employeeRoleId") || 0);
  const adminPanel = document.getElementById("adminPanel");
  if (adminPanel) {
    if (employeeRole === 1 || employeeRole === 2) {
      adminPanel.style.display = "grid";
    } else {
      adminPanel.style.display = "none";
    }
  }
}

function initializeEmployeeCreate() {
  const isLoggedIn = sessionStorage.getItem("employeeLoggedIn") === "true";
  if (!isLoggedIn) {
    window.location.href = "../public/login.html";
    return;
  }

  const form = document.getElementById("employeeCreateForm");
  if (!form) return;

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    const payload = {
      FirstName: document.getElementById("firstName").value,
      LastName: document.getElementById("lastName").value,
      Email: document.getElementById("email").value,
      Phone: document.getElementById("phone").value,
      HireDate: document.getElementById("hireDate").value,
      Status: Number(document.getElementById("status").value),
      ManagerID: Number(document.getElementById("managerId").value),
      Role: document.getElementById("role").value,
      Manager: document.getElementById("manager").checked ? 1 : 0,
      Admin: document.getElementById("admin").checked ? 1 : 0,
      Password: document.getElementById("password").value,
    };

    const apiUrl = `${apiBaseUrl}/api/employees`;

    fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then((res) => {
        if (!res.ok) return res.json().then((j) => Promise.reject(j));
        return res.json();
      })
      .then((data) => {
        alert("Employee created successfully.");
        form.reset();
      })
      .catch((err) => {
        const msg =
          err && err.error
            ? err.error
            : err && err.message
              ? err.message
              : "Failed to create employee";
        alert(msg);
      });
  });

  const resetForm = document.getElementById("employeeResetForm");
  if (resetForm) {
    resetForm.addEventListener("submit", function (e) {
      e.preventDefault();
      const payload = {
        employeeId: Number(document.getElementById("resetEmployeeId").value),
        newPassword: document.getElementById("resetPassword").value,
        createdByEmployeeId: Number(sessionStorage.getItem("employeeId")),
      };

      const apiUrl = `${apiBaseUrl}/api/employees/reset-password`;

      fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
        .then((res) => {
          if (!res.ok) return res.json().then((j) => Promise.reject(j));
          return res.json();
        })
        .then((data) => {
          alert(data.message || "Password reset successfully");
          resetForm.reset();
        })
        .catch((err) => {
          const msg =
            err && err.error
              ? err.error
              : err && err.message
                ? err.message
                : "Failed to reset password";
          alert(msg);
        });
    });
  }

  const showResetPasswordCheckbox =
    document.getElementById("showResetPassword");
  const resetPasswordInput = document.getElementById("resetPassword");
  if (showResetPasswordCheckbox && resetPasswordInput) {
    showResetPasswordCheckbox.addEventListener("change", function () {
      resetPasswordInput.type = this.checked ? "text" : "password";
    });
  }
}

function initializeMovieSearch() {
  performMovieSearch();
  const searchBtn = document.querySelector(".search-section .btn-primary");
  if (searchBtn) {
    searchBtn.addEventListener("click", performMovieSearch);
  }
}

function performMovieSearch() {
  const title = document.getElementById("searchTitle")?.value || "";
  const genre = document.getElementById("searchGenre")?.value || "";

  const apiUrl = `${apiBaseUrl}/api/movies/search`;
  fetch(apiUrl)
    .then((response) => {
      if (!response.ok) {
        return response.text().then((text) => {
          throw new Error(`Server returned ${response.status}: ${text}`);
        });
      }
      return response.json();
    })
    .then((data) => {
      let filtered = data.filter((movie) =>
        (movie.Title || "")
          .toString()
          .toLowerCase()
          .includes(title.toLowerCase()),
      );
      if (genre) {
        filtered = filtered.filter((movie) =>
          (movie.Genre || "")
            .toString()
            .toLowerCase()
            .includes(genre.toLowerCase()),
        );
      }
      populateMoviesTable(filtered);
    })
    .catch((error) => {
      console.error("Error fetching movies:", error);
      document.getElementById("moviesTableBody").innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; padding: 2rem; color: #dc3545;">
                        Error loading movies. ${error.message}
                    </td>
                </tr>
            `;
    });
}

function populateMoviesTable(movies) {
  const tableBody = document.getElementById("moviesTableBody");

  if (!movies || movies.length === 0) {
    tableBody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 2rem; color: #999;">
                    No movies found matching your search.
                </td>
            </tr>
        `;
    return;
  }

  const rows = movies
    .map(
      (movie) => `
        <tr>
            <td>${movie.Title || "N/A"}</td>
            <td>${movie.Genre || "N/A"}</td>
            <td>${movie.Rating || "N/A"}</td>
            <td>${movie.copies ?? movie.copies ?? "N/A"}</td>
            <td>
                <a href="movie-details.html?id=${movie.MovieID}" class="btn btn-primary" style="padding: 0.5rem 1rem; font-size: 0.9rem;">View</a>
            </td>
        </tr>
    `,
    )
    .join("");

  tableBody.innerHTML = rows;
}

function initializeRentalCheckout() {
  const findCustomerBtn = document.querySelector(
    ".checkout-section .btn-secondary",
  );
  if (findCustomerBtn) {
    findCustomerBtn.addEventListener("click", findCustomer);
  }

  const completeCheckoutBtn = document.querySelector(
    ".checkout-summary .btn-primary",
  );
  if (completeCheckoutBtn) {
    completeCheckoutBtn.addEventListener("click", completeCheckout);
  }

  setDefaultDueDate();
}

function renderReturnItems() {
  const table = document.getElementById("returnItems");
  table.innerHTML = "";
  let totalLateFees = 0;
  returnItems.forEach((dvd, index) => {
    const lateFee = Math.max(0, dvd.DaysLate) * 1.0;
    totalLateFees += lateFee;
    table.innerHTML += `
        <tr>
            <td>${dvd.ItemID}</td>
            <td>${dvd.Title}</td>
            <td>${new Date(dvd.DueDate).toLocaleDateString()}</td>
            <td>${Math.max(0, dvd.DaysLate)}</td>
            <td>$${lateFee.toFixed(2)}</td>
            <td>
                <button
                    class="btn btn-danger"
                    onclick="removeReturnDVD(${index})">
                    Remove
                </button>
            </td>
        </tr>
        `;
  });
  updateReturnSummary();
}

function removeReturnDVD(index) {
  returnItems.splice(index, 1);
  renderReturnItems();
}

function updateReturnSummary() {
  if (returnItems.length === 0) {
    document.getElementById("returnCustomerName").textContent = "";
    document.getElementById("dvdReturnCount").textContent = 0;
    document.getElementById("totalLateFees").textContent = "0.00";
    document.getElementById("paymentRequired").textContent = "0.00";
    return;
  }
  document.getElementById("returnCustomerName").textContent =
    returnItems[0].CustomerName;
  document.getElementById("dvdReturnCount").textContent = returnItems.length;
  const totalLateFees = returnItems.reduce((sum, item) => {
    return sum + Math.max(0, item.DaysLate);
  }, 0);
  document.getElementById("totalLateFees").textContent =
    totalLateFees.toFixed(2);
  document.getElementById("paymentRequired").textContent =
    totalLateFees.toFixed(2);
}

async function loadDashboard() {
  const adminPanel = document.getElementById("adminPanel");
  if (!adminPanel) return;
  const isManager = sessionStorage.getItem("employeeManager") === "1";
  const isAdmin = sessionStorage.getItem("employeeAdmin") === "1";
  console.log(isManager, isAdmin);
  if (isManager || isAdmin) {
    adminPanel.style.display = "block";
  } else {
    adminPanel.style.display = "none";
  }
}

function requireManagerOrAdmin() {
  const isManager = sessionStorage.getItem("employeeManager") === "1";
  const isAdmin = sessionStorage.getItem("employeeAdmin") === "1";
  if (!isManager && !isAdmin) {
    alert("You do not have permission to access this page.");
    window.location.href = "../employee/dashboard.html";
  }
}

async function registerCustomer() {
  const payload = {
    firstName: document.getElementById("firstName").value.trim(),
    lastName: document.getElementById("lastName").value.trim(),
    email: document.getElementById("email").value.trim(),
    phone: document.getElementById("phone").value.trim(),
    streetAddress: document.getElementById("streetAddress").value.trim(),
    city: document.getElementById("city").value.trim(),
    state: document.getElementById("state").value.trim(),
    zipCode: document.getElementById("zipCode").value.trim(),
    password: document.getElementById("password").value,
  };
  try {
    const response = await fetch("/api/customers", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Unable to create account.");
    }
    if (data.id) {
      sessionStorage.setItem("customerLoggedIn", "true");
      sessionStorage.setItem("customerId", data.id);
      if (data.customer) {
        sessionStorage.setItem(
          "customerName",
          data.customer.name ||
            data.customer.Name ||
            `${payload.firstName} ${payload.lastName}`,
        );
        sessionStorage.setItem(
          "customerEmail",
          data.customer.Email || data.customer.email || payload.email,
        );
      } else {
        sessionStorage.setItem(
          "customerName",
          `${payload.firstName} ${payload.lastName}`,
        );
        sessionStorage.setItem("customerEmail", payload.email);
      }
      alert("Account created successfully.");
      window.location.href = "customer-portal.html";
    } else {
      alert("Account created successfully.");
      window.location.href = "customer-login.html";
    }
  } catch (err) {
    alert("Request failed: " + err.message);
  }
}

async function addReturnDVD() {
  const id = document.getElementById("dvdReturn").value.trim();
  if (id === "") return;
  const response = await fetch(`/api/returns/item/${id}`);
  if (!response.ok) {
    alert("DVD not found.");
    return;
  }
  const dvd = await response.json();
  if (returnItems.some((x) => x.ItemID == dvd.ItemID)) {
    alert("DVD already entered.");
    return;
  }
  returnItems.push(dvd);
  renderReturnItems();
  document.getElementById("dvdReturn").value = "";
}

async function addDVD() {
  const id = document.getElementById("dvdScan").value.trim();
  if (id === "") return;
  const response = await fetch(`/api/inventory/item/${id}`);
  if (!response.ok) {
    alert("DVD not available.");
    return;
  }
  const dvd = await response.json();
  if (checkoutItems.some((x) => x.ItemID == dvd.ItemID)) {
    alert("DVD already added.");
    return;
  }
  checkoutItems.push(dvd);
  renderCheckoutItems();
  document.getElementById("dvdScan").value = "";
}

async function findCustomer() {
  const customerLookup = document.getElementById("customerLookup")?.value;
  if (!customerLookup) {
    alert("Please enter customer name or ID");
    return;
  }
  try {
    const response = await fetch(
      `/api/customerlookup/${encodeURIComponent(customerLookup)}`,
    );
    if (!response.ok) {
      throw new Error("Customer not found.");
    }
    const customer = await response.json();
    if (customer.verified.data[0] === 0) {
      alert("Customer is not verified.");
      return;
    }
    document.getElementById("selectedCustomerName").textContent =
      customer.CustomerName;
    customerBalance = Number(customer.CurrentBalance) || 0;
    document.getElementById("selectedCustomerBalance").textContent =
      customerBalance.toFixed(2);
    updateCheckoutTotals();
    document.getElementById("customerInfo").style.display = "block";
    window.selectedCustomer = customer;
  } catch (err) {
    alert(err.message);
  }
  document.getElementById("customerInfo").style.display = "block";
}

async function completeCheckout() {
  const response = await fetch("/api/checkout", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      CustomerID: window.selectedCustomer.CustomerID,
      EmployeeID: 1,
      Items: checkoutItems.map((x) => x.ItemID),
      PaymentMethod: document.getElementById("paymentMethod").value,
    }),
  });
  const result = await response.json();
}

function setDefaultDueDate() {
  const dueDateElement = document.getElementById("dueDate");
  if (dueDateElement) {
    const today = new Date();
    const dueDate = new Date(today);
    dueDate.setDate(dueDate.getDate() + 3);
    dueDateElement.textContent = dueDate.toLocaleDateString();
  }
}

function initializeReturnProcessing() {
  const completeReturnBtn = document.querySelector(
    ".return-summary .btn-primary",
  );
  if (completeReturnBtn) {
    completeReturnBtn.addEventListener("click", completeReturn);
  }
}

function editEmployee(id) {
  window.location.href = `edit-employee.html?id=${id}`;
}

function editMovie(id) {
  window.location.href = `edit-movie.html?id=${id}`;
}

async function loadMovieDropdown() {
  const response = await fetch("/api/movies/active");
  const movies = await response.json();
  const select = document.getElementById("movie");
  select.innerHTML = "";
  movies.forEach((movie) => {
    select.innerHTML += `
            <option value="${movie.MovieID}">
                ${movie.Title}
            </option>
        `;
  });
}

async function completeReturn() {
  if (returnItems.length === 0) {
    alert("Please add at least one DVD.");
    return;
  }
  const paymentMethod = document.getElementById("returnPaymentMethod").value;
  const response = await fetch("/api/returns", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      EmployeeID: Number(sessionStorage.getItem("employeeId")),
      PaymentMethod: paymentMethod,
      Items: returnItems.map((item) => item.ItemID),
    }),
  });
  const result = await response.json();
  if (!response.ok) {
    alert(result.error);
    return;
  }
  alert("Return processed successfully!");
  returnItems = [];
  renderReturnItems();
  document.getElementById("dvdReturn").value = "";
  document.getElementById("returnCustomerName").textContent = "";
  document.getElementById("dvdReturnCount").textContent = "0";
  document.getElementById("totalLateFees").textContent = "0.00";
  document.getElementById("paymentRequired").textContent = "0.00";
}

async function loadCustomers(search = "") {
  const response = await fetch(
    `/api/customers_management?search=${encodeURIComponent(search)}`,
  );
  const customers = await response.json();
  const table = document.getElementById("customerTable");
  table.innerHTML = "";
  customers.forEach((customer) => {
    table.innerHTML += `<tr>
        <td>${customer.CustomerID}</td>
        <td>${customer.CustomerName}</td>
        <td>${customer.Email}</td>
        <td>${customer.Phone}</td>
        <td>${customer.verified.data[0] ? "Yes" : "No"}</td>
        <td>${customer.Active.data[0] ? "Active" : "Inactive"}</td>
        <td>$${Number(customer.CurrentBalance).toFixed(2)}</td>
        <td>
            ${
              customer.verified.data[0] === 0
                ? `<button
                    class="btn btn-success"
                    onclick="verifyCustomer(${customer.CustomerID})">
                    Verify
                </button>`
                : ""
            }
            ${
              customer.Active.data[0] === 1
                ? `<button
                    class="btn btn-danger"
                    onclick="deactivateCustomer(${customer.CustomerID})">
                    Deactivate
                </button>`
                : `<button
                    class="btn btn-primary"
                    onclick="activateCustomer(${customer.CustomerID})">
                    Activate
                </button>`
            }
        </td>
        </tr>`;
  });
}

async function verifyCustomer(id) {
  if (!confirm("Verify this customer?")) return;
  await fetch(`/api/customers_management/${id}/verify`, {
    method: "PUT",
  });
  loadCustomers();
}

async function activateCustomer(id) {
  await fetch(`/api/customers_management/${id}/activate`, {
    method: "PUT",
  });
  loadCustomers();
}

async function deactivateCustomer(id) {
  if (!confirm("Deactivate this customer account?")) return;
  await fetch(`/api/customers_management/${id}/deactivate`, {
    method: "PUT",
  });
  loadCustomers();
}

async function loadManagers() {
  const response = await fetch("/api/managers");
  const managers = await response.json();
  const select = document.getElementById("managerID");
  select.innerHTML = "";
  managers.forEach((manager) => {
    select.innerHTML += `<option value="${manager.EmployeeID}"> ${manager.EmployeeName} </option>`;
  });
}

async function loadEmployee() {
  const employeeID = new URLSearchParams(window.location.search).get("id");
  const response = await fetch(`/api/employee/${employeeID}`);
  const employee = await response.json();
  document.getElementById("firstName").value = employee.FirstName;
  document.getElementById("lastName").value = employee.LastName;
  document.getElementById("email").value = employee.Email;
  document.getElementById("phone").value = employee.Phone;
  document.getElementById("managerID").value = employee.ManagerID;
  document.getElementById("role").value = employee.Role;
  document.getElementById("manager").checked = employee.Manager.data[0] === 1;
  document.getElementById("admin").checked = employee.Admin.data[0] === 1;
  document.getElementById("status").value = employee.Status.data[0];
}

async function saveEmployee(e) {
  e.preventDefault();
  const employeeID = new URLSearchParams(window.location.search).get("id");

  const response = await fetch(`/api/employee/${employeeID}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      FirstName: document.getElementById("firstName").value,
      LastName: document.getElementById("lastName").value,
      Phone: document.getElementById("phone").value,
      Email: document.getElementById("email").value,
      Status: document.getElementById("status").value === "1" ? 1 : 0,
      ManagerID: document.getElementById("managerID").value,
      Role: document.getElementById("role").value,
      Manager: document.getElementById("manager").checked ? 1 : 0,
      Admin: document.getElementById("admin").checked ? 1 : 0,
    }),
  });
  if (response.ok) {
    alert("Employee updated successfully.");
    window.location.href = "user-management.html";
  } else {
    alert("Unable to update employee.");
  }
}

async function loadEmployees(search = "") {
  const response = await fetch(
    `/api/employees?search=${encodeURIComponent(search)}`,
  );
  const employees = await response.json();
  const table = document.getElementById("userTable");
  table.innerHTML = "";
  employees.forEach((employee) => {
    table.innerHTML += `
        <tr>
            <td>${employee.EmployeeID}</td>
            <td>${employee.EmployeeName}</td>
            <td>${employee.Email}</td>
            <td>${employee.Phone}</td>
            <td>${employee.Role}</td>
            <td>${employee.ManagerName ?? ""}</td>
            <td>${employee.Status.data[0] ? "Active" : "Inactive"}</td>
            <td>
                <button
                    class="btn btn-primary"
                    onclick="editEmployee(${employee.EmployeeID})">
                    Edit
                </button>
            </td>
        </tr>
        `;
  });
}

async function addCopy(e) {
  e.preventDefault();
  const response = await fetch("/api/inventory", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      MovieID: document.getElementById("movie").value,
      PurchaseDate: document.getElementById("purchaseDate").value,
      Cost: document.getElementById("cost").value,
      Status: document.getElementById("status").value,
    }),
  });
  const result = await response.json();
  if (!response.ok) {
    alert(result.error);
    return;
  }
  alert("DVD copy added successfully.");
  window.location.href = "inventory-management.html";
}

async function loadInventory(search = "") {
  const response = await fetch(
    `/api/inventory?search=${encodeURIComponent(search)}`,
  );
  const inventory = await response.json();
  const table = document.getElementById("inventoryTable");
  table.innerHTML = "";
  inventory.forEach((item) => {
    table.innerHTML += `
        <tr>
        <td>${item.ItemID}</td>
        <td>${item.Title}</td>
        <td>${item.Status}</td>
        <td>${new Date(item.PurchaseDate).toLocaleDateString()}</td>
        <td>$${Number(item.Cost).toFixed(2)}</td>
        <td>
            ${
              item.Status !== "written off"
                ? `<button
                    class="btn btn-danger"
                    onclick="writeOff(${item.ItemID})">
                    Write Off
                </button>`
                : ""
            }
        </td>
        </tr>
        `;
  });
}

async function addMovie(e) {
  e.preventDefault();
  const response = await fetch("/api/movie", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      Title: document.getElementById("title").value,
      Description: document.getElementById("description").value,
      Rating: document.getElementById("rating").value,
      ReleaseYear: document.getElementById("releaseYear").value,
      Status: document.getElementById("status").value,
      RentalCategoryID: document.getElementById("category").value,
    }),
  });
  const result = await response.json();
  if (!response.ok) {
    alert(result.error);
    return;
  }
  alert("Movie added successfully.");
  window.location.href = "movie-management.html";
}

function logout() {
  sessionStorage.removeItem("employeeLoggedIn");
  sessionStorage.removeItem("employeeId");
  sessionStorage.removeItem("employeeRole");
  sessionStorage.removeItem("employeeName");
  localStorage.clear();
  sessionStorage.clear();
  window.location.href = "../../Index.html";
}

function clearForm() {
  const form = document.getElementById("loginForm");
  if (form) form.reset();

  const showPasswordCheckbox = document.getElementById("showPassword");
  if (showPasswordCheckbox) showPasswordCheckbox.checked = false;

  const passwordInput = document.getElementById("password");
  if (passwordInput) passwordInput.type = "password";
}

function logoutCustomer() {
  sessionStorage.removeItem("customerLoggedIn");
  sessionStorage.removeItem("customerID");
  sessionStorage.removeItem("customerName");
  sessionStorage.removeItem("customerEmail");
  updateNavLinksBasedOnLoginStatus();
  window.location.href = "../../Index.html";
}

function loadMovieDetails(movieId) {
  const apiUrl = `${apiBaseUrl}/api/movies/${movieId}`;

  fetch(apiUrl)
    .then((response) => {
      if (!response.ok) {
        return response.text().then((text) => {
          throw new Error(`Server returned ${response.status}: ${text}`);
        });
      }
      return response.json();
    })
    .then((movie) => {
      document.getElementById("movieTitle").textContent = movie.Title || "N/A";
      document.getElementById("movieGenres").textContent = movie.Genre || "N/A";
      document.getElementById("movieRating").textContent =
        movie.Rating || "N/A";
      document.getElementById("movieDescription").textContent =
        movie.Description || "No description available";
      document.getElementById("availableCopies").textContent =
        movie.copies ?? movie.copies ?? "N/A";
    })
    .catch((error) => {
      console.error("Error loading movie details:", error);
      document.querySelector(".movie-info").innerHTML = `
                <p style="color: #dc3545;">
                    Error loading movie details: ${error.message}
                </p>
            `;
    });
}

function initializeMovieDetails() {
  const params = new URLSearchParams(window.location.search);
  const movieId = params.get("id");
  if (!movieId) {
    const movieInfo = document.querySelector(".movie-info");
    if (movieInfo) {
      movieInfo.innerHTML = "<p>No movie ID provided.</p>";
    }
    return;
  }
  loadMovieDetails(movieId);
  const reserveBtn = document.getElementById("reserveBtn");
  if (reserveBtn) {
    reserveBtn.addEventListener("click", handleReserve);
  }
}

async function loadMovie() {
  const movieID = new URLSearchParams(window.location.search).get("id");

  const response = await fetch(`/api/movie/${movieID}`);
  const movie = await response.json();

  document.getElementById("title").value = movie.Title;
  document.getElementById("description").value = movie.Description;
  document.getElementById("rating").value = movie.Rating;
  document.getElementById("releaseYear").value = movie.ReleaseYear;
  document.getElementById("status").value = movie.Status;
  document.getElementById("category").value = movie.RentalCategoryID;
}

async function loadRentalCategories() {
  const response = await fetch("/api/rental-categories");
  const categories = await response.json();
  const select = document.getElementById("category");

  select.innerHTML = "";
  categories.forEach((category) => {
    select.innerHTML += `
            <option value="${category.RentalCategoryID}">
                ${category.CategoryName}
            </option>
        `;
  });
}

async function deleteMovie(id) {
  if (!confirm("Mark this movie as inactive?")) return;
  await fetch(`/api/movie/${id}/inactive`, {
    method: "PUT",
  });
  loadMovieManagement();
}

async function saveMovie(e) {
  const movieID = new URLSearchParams(window.location.search).get("id");
  e.preventDefault();
  await fetch(`/api/movie/${movieID}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      Title: document.getElementById("title").value,

      Description: document.getElementById("description").value,

      Rating: document.getElementById("rating").value,

      ReleaseYear: document.getElementById("releaseYear").value,

      Status: document.getElementById("status").value,

      RentalCategoryID: document.getElementById("category").value,
    }),
  });

  alert("Movie updated successfully.");
  window.location = "movie-management.html";
}

async function loadMovieManagement(search = "") {
  try {
    const response = await fetch(
      `/api/movies/management?search=${encodeURIComponent(search)}`,
    );

    if (!response.ok) throw new Error("Unable to load movies.");

    const movies = await response.json();

    const table = document.getElementById("movieManagementTable");
    table.innerHTML = "";

    movies.forEach((movie) => {
      table.innerHTML += `
                <tr>
                    <td>${movie.MovieID}</td>
                    <td>${movie.Title}</td>
                    <td>${movie.Description}</td>
                    <td>${movie.Rating}</td>
                    <td>${movie.ReleaseYear}</td>
                    <td>${movie.Status}</td>
                    <td>${movie.CategoryName}</td>
                    <td>$${Number(movie.RentalPrice).toFixed(2)}</td>
                    <td>
                        <button class="btn btn-primary" onclick="editMovie(${movie.MovieID})">Edit</button>
                        <button class="btn btn-danger" onclick="deleteMovie(${movie.MovieID})">Delete</button>
                    </td>
                </tr>
            `;
    });
  } catch (err) {
    console.error(err);
  }
}

async function loadRentalsByDueDate() {
  try {
    const response = await fetch("/api/rentals_by_due_date");
    const result = await response.json();
    const table = document.getElementById("rentalsDueDateTable");
    table.innerHTML = "";
    if (result.length === 0) {
      table.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align:center;">
                        No current rentals.
                    </td>
                </tr>
            `;
      return;
    }

    result.forEach((item) => {
      const due = new Date(item.dueDate);
      const today = new Date();
      let rowColor = "";
      if (due < today) {
        rowColor = 'style="background:#f8d7da;"';
      } else if (due.toDateString() === today.toDateString()) {
        rowColor = 'style="background:#fff3cd;"';
      }
      table.innerHTML += `
                <tr ${rowColor}>
                    <td>${new Date(item.dueDate).toLocaleDateString()}</td>
                    <td>${item.customerName}</td>
                    <td>${item.Title}</td>
                    <td>${item.ItemID}</td>
                    <td>${new Date(item.RentalDate).toLocaleDateString()}</td>
                    <td>${item.employeeName}</td>
                </tr>
            `;
    });
  } catch (err) {
    console.error(err);
  }
}
async function writeOff(itemID) {
  if (!confirm("Mark this DVD copy as written off?")) return;
  await fetch(`/api/inventory/${itemID}/writeoff`, {
    method: "PUT",
  });
  loadInventory();
}
async function loadWriteoffReport() {
  try {
    const response = await fetch("/api/writeoff-report");
    const result = await response.json();
    const table = document.getElementById("writeoffTable");
    table.innerHTML = "";
    if (result.length === 0) {
      table.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align:center">
                        No write-offs found.
                    </td>
                </tr>
            `;
      return;
    }
    result.rows.forEach((item) => {
      table.innerHTML += `
                <tr>
                    <td>${item.ItemID}</td>
                    <td>${item.Title}</td>
                    <td>${item.customerName}</td>
                    <td>${item.RentalDate}</td>
                    <td>${item.dueDate}</td>
                    <td>${item.daysLate}</td>
                    <td>${item.employeeName}</td>
                    <td>$${Number(item.cost).toFixed(2)}</td>
                </tr>
            `;
    });
    document.getElementById("totalWriteoffs").textContent = result.rows.length;
    document.getElementById("totalWriteoffValue").textContent =
      result.totalValue;
  } catch (error) {
    console.error(error);
  }
}

async function initializeCustomerPortal() {
  const customerID = sessionStorage.getItem("customerID");
  if (!customerID) {
    window.location.href = "customer-login.html";
    return;
  }
  document.getElementById("customerName").textContent =
    sessionStorage.getItem("customerName") || "Customer";
  await loadCurrentRentals(customerID);
  await loadRentalHistory(customerID);
  await loadAccountInfo(customerID);
  await loadWishlist(customerID);
}

async function loadCurrentRentals(customerID) {
  const response = await fetch(`/api/customer/${customerID}/current-rentals`);
  const rentals = await response.json();
  const table = document.getElementById("currentRentalsTable");
  table.innerHTML = "";
  rentals.forEach((rental) => {
    table.innerHTML += `
            <tr>
                <td>${rental.Title}</td>
                <td>${formatDate(rental.RentalDate)}</td>
                <td>${formatDate(rental.DueDate)}</td>
                <td>${rental.RentalStatus}</td>
            </tr>
        `;
  });
}

async function loadRentalHistory(customerID) {
  const response = await fetch(`/api/customer/${customerID}/history`);
  const history = await response.json();
  const table = document.getElementById("rentalHistoryTable");
  table.innerHTML = "";
  history.forEach((rental) => {
    table.innerHTML += `
            <tr>
                <td>${rental.Title}</td>
                <td>${formatDate(rental.RentalDate)}</td>
            </tr>
        `;
  });
}

async function loadAccountInfo(customerID) {
  const response = await fetch(`/api/customer/${customerID}/account`);
  const customer = await response.json();
}

async function loadWishlist(customerID) {
  const response = await fetch(`/api/customer/${customerID}/wishlist`);
  const wishlist = await response.json();
  const table = document.getElementById("wishlistTable");
  table.innerHTML = "";
  wishlist.forEach((movie) => {
    table.innerHTML += `
            <tr>
                <td>${movie.Title}</td>
                <td>${formatDate(movie.ReservationDate)}</td>
                <td>${movie.Status}</td>
                <td>
                    <button
                        class="btn btn-danger"
                        onclick="removeWishlistItem(${movie.ReservationID})">
                        Remove
                    </button>
                </td>
            </tr>
        `;
  });
}

async function removeWishlistItem(reservationID) {
  if (!confirm("Remove this movie from your wishlist?")) {
    return;
  }
  await fetch(`/api/wishlist/${reservationID}`, {
    method: "DELETE",
  });
  loadWishlist(sessionStorage.getItem("customerID"));
}

function initializeCustomerLogin() {
  const form = document.getElementById("customerLoginForm");
  if (form) {
    form.addEventListener("submit", loginCustomer);
  }
  const showPassword = document.getElementById("customerShowPassword");
  const password = document.getElementById("customerPassword");
  if (showPassword && password) {
    showPassword.addEventListener("change", function () {
      password.type = this.checked ? "text" : "password";
    });
  }
}

async function loginCustomer(e) {
  e.preventDefault();
  const email = document.getElementById("customerEmail").value;
  const password = document.getElementById("customerPassword").value;
  const apiUrl = `${apiBaseUrl}/api/customer/login`;
  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });
    const data = await response.json();
    if (!response.ok) {
      alert(data.error || "Login failed");
      return;
    }
    const customer = data.customer;
    sessionStorage.setItem("customerLoggedIn", "true");
    sessionStorage.setItem("customerID", customer.CustomerID);
    sessionStorage.setItem(
      "customerName",
      `${customer.FirstName} ${customer.LastName}`,
    );
    sessionStorage.setItem("customerEmail", customer.Email);
    window.location.href = "customer-portal.html";
  } catch (err) {
    alert("Login failed.");
    console.error(err);
  }
}

async function forgotPassword() {
  const email = document.getElementById("email")?.value.trim();
  if (!email) {
    alert("Please enter your account email.");
    return;
  }
  try {
    const response = await fetch("/api/customers/forgot-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Unable to request password reset.");
    }
    if (data.token) {
      document.getElementById("tokenText").textContent = data.token;
      document.getElementById("tokenArea").style.display = "block";
    } else {
      alert(
        "If an account exists with that email, a reset token has been generated.",
      );
    }
  } catch (err) {
    alert("Request failed: " + err.message);
  }
}

async function resetCustomerPassword() {
  const token = document.getElementById("token")?.value.trim();
  const newPassword = document.getElementById("newPassword")?.value;
  if (!token || !newPassword) {
    alert("Please enter the reset token and a new password.");
    return;
  }
  try {
    const response = await fetch("/api/customers/reset-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        token,
        newPassword,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Unable to reset password.");
    }
    if (data.success) {
      alert("Password reset successfully. You can now log in.");
      window.location.href = "customer-login.html";
    } else {
      alert("Token invalid or expired.");
      window.location.href = "customer-login.html";
    }
  } catch (err) {
    alert("Request failed: " + err.message);
  }
}

// Handle customer wishlist
function handleReserve() {
  const customerID = sessionStorage.getItem("customerID");
  const isLoggedIn = sessionStorage.getItem("customerLoggedIn") === "true";

  if (!isLoggedIn || !customerID) {
    showReserveMessage(
      "Please log in to your account to add items to your wishlist.",
      "error",
    );
    setTimeout(() => {
      window.location.href = "customer-login.html";
    }, 2000);
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const movieId = params.get("id");

  if (!movieId) {
    showReserveMessage("Error: Movie ID not found.", "error");
    return;path
  }

  const apiUrl = `${apiBaseUrl}/api/reservations`;

  const reservationData = {
    customer_id: customerID,
    movie_id: movieId,
    reserved_date: new Date().toISOString().split("T")[0],
  };

  fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(reservationData),
  })
    .then((response) => {
      if (!response.ok) {
        return response.json().then((data) => {
          throw new Error(data.error || `Server error: ${response.status}`);
        });
      }
      return response.json();
    })
    .then((data) => {
      showReserveMessage(
        "Movie added to wishlist successfully! Check your account for details.",
        "success",
      );
      document.getElementById("reserveBtn").disabled = true;
    })
    .catch((error) => {
      console.error("Reservation error:", error);
      showReserveMessage(`Reservation failed: ${error.message}`, "error");
    });
}

// Manager or Admin required pages
if (
  window.location.pathname.includes("user-management.html") ||
  window.location.pathname.includes("create-employee.html") ||
  window.location.pathname.includes("edit-employee.html")
) {
  requireManagerOrAdmin();
}

// Load page-specific functionality

function initializePageSpecific(page) {
  switch (page) {
    case "login.html":
      initializeLogin();
      break;
    case "dashboard.html":
      initializeEmployeeDashboard();
      loadDashboard();
      break;
    case "create-employee.html":
      initializeEmployeeCreate();
      break;
    case "movie-search.html":
      initializeMovieSearch();
      break;
    case "rental-checkout.html":
      initializeRentalCheckout();
      break;
    case "return-processing.html":
      initializeReturnProcessing();
      break;
    case "reports-dashboard.html":
      initializeReportsDashboard();
      break;
    case "customer-portal.html":
      initializeCustomerPortal();
      break;
    case "customer-login.html":
      initializeCustomerLogin();
      break;
    case "movie-details.html":
      initializeMovieDetails();
      break;
    default:
      break;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  updateNavLinksBasedOnLoginStatus();
  initializeNavbar();
  const currentPage = window.location.pathname.split("/").pop();
  initializePageSpecific(currentPage);
  if (document.getElementById("movieManagementTable")) {
    loadMovieManagement();
    document.getElementById("movieSearch").addEventListener("input", (e) => {
      loadMovieManagement(e.target.value);
    });
  }
  if (document.getElementById("writeoffTable")) {
    loadWriteoffReport();
  }
  if (document.getElementById("rentalsDueDateTable")) {
    loadRentalsByDueDate();
  }
  if (document.getElementById("editMovieForm")) {
    const editForm = document.getElementById("editMovieForm");
    editForm.addEventListener("submit", saveMovie);
    (async () => {
      await loadRentalCategories();
      await loadMovie();
    })();
  }
  if (document.getElementById("addMovieForm")) {
    document
      .getElementById("addMovieForm")
      .addEventListener("submit", addMovie);
    loadRentalCategories();
  }
  if (document.getElementById("inventoryTable")) {
    loadInventory();
    document
      .getElementById("inventorySearch")
      .addEventListener("input", (e) => {
        loadInventory(e.target.value);
      });
    if (document.getElementById("addCopyBtn")) {
      document.getElementById("addCopyBtn").addEventListener("click", () => {
        window.location.href = "add-copy.html";
      });
    }
  }
  if (document.getElementById("addCopyForm")) {
    document.getElementById("addCopyForm").addEventListener("submit", addCopy);
    loadMovieDropdown();
  }
  if (document.getElementById("customerTable")) {
    loadCustomers();
    document.getElementById("customerSearch").addEventListener("input", (e) => {
      loadCustomers(e.target.value);
    });
  }
  if (document.getElementById("dvdScan")) {
    document.getElementById("dvdScan").addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        addDVD();
      }
      document
        .getElementById("completeCheckoutBtn")
        .addEventListener("click", completeCheckout);
    });
  }
  if (document.getElementById("dvdReturn")) {
    document.getElementById("dvdReturn").addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        addReturnDVD();
      }
    });
  }
  if (document.getElementById("employeeSearch")) {
    document.getElementById("employeeSearch").addEventListener("input", (e) => {
      loadEmployees(e.target.value);
    });
  }
  if (document.getElementById("userTable")) {
    loadEmployees();
  }
  if (document.getElementById("editEmployeeForm")) {
    loadManagers();
    loadEmployee();
    document
      .getElementById("editEmployeeForm")
      .addEventListener("submit", saveEmployee);
  }
  if (document.getElementById("forgotForm")) {
    document
      .getElementById("forgotForm")
      .addEventListener("submit", function (e) {
        e.preventDefault();
        forgotPassword();
      });
  }
  if (document.getElementById("registerForm")) {
    registerForm.addEventListener("submit", function (e) {
      e.preventDefault();
      registerCustomer();
    });
    const showPassword = document.getElementById("showRegisterPassword");
    const passwordInput = document.getElementById("password");

    if (showPassword && passwordInput) {
      showPassword.addEventListener("change", function () {
        passwordInput.type = this.checked ? "text" : "password";
      });
    }
  }
  if (document.getElementById("resetForm")) {
    document
      .getElementById("resetForm")
      .addEventListener("submit", function (e) {
        e.preventDefault();
        resetCustomerPassword();
      });
    const showPassword = document.getElementById("showResetPassword");
    const passwordInput = document.getElementById("newPassword");
    if (showPassword && passwordInput) {
      showPassword.addEventListener("change", function () {
        passwordInput.type = this.checked ? "text" : "password";
      });
    }
  }
});
function printReport() {
  window.print();
}

function showReserveMessage(message, type) {
  const msgDiv = document.getElementById("reserveMessage");
  msgDiv.style.color = type === "error" ? "#dc3545" : "#28a745";
  msgDiv.style.padding = "1rem";
  msgDiv.style.borderRadius = "4px";
  msgDiv.style.backgroundColor = type === "error" ? "#f8d7da" : "#d4edda";
  msgDiv.style.border = `1px solid ${type === "error" ? "#f5c6cb" : "#c3e6cb"}`;
  msgDiv.textContent = message;
}

window.BCRPrototype = {
  formatCurrency,
  formatDate,
  logout,
  logoutCustomer,
  performMovieSearch,
  loadMovieDetails,
  loadMovieManagement,
  handleReserve,
  findCustomer,
  completeCheckout,
  completeReturn,
};
