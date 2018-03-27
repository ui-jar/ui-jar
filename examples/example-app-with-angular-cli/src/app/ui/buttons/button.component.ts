import { Component, OnInit } from '@angular/core';

/**
 * @group Button & indicators
 * @component Button
 * @description
 * <h1>Usage</h1>
 * Lorem ipsum dolor sit amet, consectetur adipiscing elit.
 */
@Component({
  selector: 'button[primary], button[secondary], button[warning]',
  templateUrl: './button.component.html',
  styleUrls: ['./button.component.css']
})
export class ButtonComponent implements OnInit {

  constructor() { }

  /**
   * Init button
   */
  ngOnInit() {
  }

}
