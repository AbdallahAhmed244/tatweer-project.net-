-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Sep 03, 2026 at 03:21 PM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `stockmarketdb`
--

-- --------------------------------------------------------

--
-- Table structure for table `stocks`
--

CREATE TABLE `stocks` (
  `Id` int(11) NOT NULL,
  `Symbol` varchar(10) NOT NULL,
  `Name` varchar(100) NOT NULL,
  `Price` decimal(18,2) NOT NULL,
  `LastUpdated` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `stocks`
--

INSERT INTO `stocks` (`Id`, `Symbol`, `Name`, `Price`, `LastUpdated`) VALUES
(3, 'NVDA', 'NVIDIA Corp.', 224.41, '2026-09-03 12:10:35'),
(7, 'ETHEREUM', 'ETHEREUM', 2417.01, '2026-09-03 16:20:16'),
(10, 'GOOGL', 'GOOGL', 337.12, '2026-09-03 15:13:21'),
(11, 'BITCOIN', 'BITCOIN', 78472.00, '2026-09-03 16:19:55'),
(12, 'META', 'META', 592.85, '2026-09-03 15:18:39'),
(23, 'TSLA', 'TSLA', 357.01, '2026-09-03 15:32:22'),
(28, 'LINK', 'LINK', 11.40, '2026-09-03 16:16:13'),
(29, 'V', 'V', 378.40, '2026-09-03 15:44:46'),
(30, 'P', 'P', 92.43, '2026-09-03 15:47:58');

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `Id` int(11) NOT NULL,
  `Username` varchar(50) NOT NULL,
  `PasswordHash` varchar(255) NOT NULL,
  `Role` varchar(20) NOT NULL DEFAULT 'User',
  `CreatedAt` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`Id`, `Username`, `PasswordHash`, `Role`, `CreatedAt`) VALUES
(1, 'admin', '100000.pUoZrjlP7rMCkmYLIuyVQg==.iEYpelGsDChPLx6fXZTLhSrF8fROnusdbTlXu+ITubQ=', 'Admin', '2026-09-03 10:56:59'),
(2, 'abdallah', '100000.ptwpKw8RMcmfm1RtIo9Leg==.lAMRqvGvBxN5v2K6XbSiKlzMFqXdaOWBwiJVIhvm7Vk=', 'User', '2026-09-03 14:01:37');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `stocks`
--
ALTER TABLE `stocks`
  ADD PRIMARY KEY (`Id`),
  ADD UNIQUE KEY `Symbol` (`Symbol`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`Id`),
  ADD UNIQUE KEY `Username` (`Username`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `stocks`
--
ALTER TABLE `stocks`
  MODIFY `Id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=31;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `Id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
