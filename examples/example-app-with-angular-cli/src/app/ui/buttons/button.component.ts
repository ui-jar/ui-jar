import { Component, OnInit } from '@angular/core';

/**
 * @group Button & indicators
 * @component Button
 * @description
 * Lorem ipsum dolor sit amet, consectetur adipiscing elit.
 */
@Component({
  selector: 'button[primary], button[secondary]',
  templateUrl: './button.component.html',
  styleUrls: ['./button.component.css']
})
export class ButtonComponent implements OnInit {

  constructor() { }

  ngOnInit() {
  }

}
