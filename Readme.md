iPlant Condor Monitor
=====================

Service used to monitor condor jobs on a condor cluster.


NOTICE
======

This code is being released purely to be more open. A complete rewrite in Clojure is currently in development. This code is primarily intended as a reference.


Installation, Running and Basic Usage
-------------------------------------
*Note: The following instructions assume you are running as root.  Throw sudo
on the front of there if you're not*

Use yum to install the monitor on whatever machine you wish to use it on:

    root:~# yum install iplant-monitor

To start and stop the service use the service program:

    root:~# service iplant-monitor start
    root:~# service iplant-monitor stop
    root:~# service iplant-monitor restart

This will start condor monitor under the **condor** user.

To see if the monitor is running use the status command:

    root:~# service iplant-monitor status

Or ps magic:

    root:~# ps -few | grep monitor

Configuration
-------------

The configuration for condor monitor lives in 2 different places.  The main
configuration files are located here:

    /etc/iplant-condormonitor.conf
    /usr/local/lib/node/iplant-monitor/condor_q.conf
    /usr/local/lib/node/iplant-monitor/condor_history.conf

Log rotate lives under `/etc/logrotate.d/iplant-monitor` (as is standard).
